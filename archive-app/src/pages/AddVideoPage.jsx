import {
  useAppStore
} from "../stores/index.js";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Database,
  Eye,
  FileText,
  HardDrive,
  Sparkles,
  Tags,
  UploadCloud,
  Video
} from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { jsx as runtimeJsx } from "react/jsx-runtime";
import { AnimatePresence, motion } from "framer-motion";

import { getFieldsForSelection, groupCustomFields, getVisibleFields, getMissingRequiredFields } from "../features/types/viewModel.js";
import { StarRating } from "../components/common/StarRating.jsx";
import {
  createLocalFileValue,
  createVideoLocalFilePatch,
  createVideoItemValue,
  normalizeLocalFileValue,
  parseVideoTags
} from "../features/videos/viewModel.js";
import { formatFileSize } from "../utils/formatting.js";
import { MotionPage, PageHero, SaveIndicator, WorkflowStepper } from "../components/ui/V1Primitives.jsx";
import { useFormSaveState } from "../components/common/useFormSaveState.js";
import { useAiAssist } from "../features/ai/useAiAssist.js";
import { AiAssistBar } from "../features/ai/AiAssistBar.jsx";
import { applyProofread, applySummaryToNotes, buildSuggestPayload, correctionsCount, hasSourceText, mergeTagText } from "../features/ai/viewModel.js";
import { TagAutocomplete } from "../components/forms/TagAutocomplete.jsx";
import { TemplatePicker } from "../components/templates/TemplatePicker.jsx";
import { QuickAddBar } from "../components/templates/QuickAddBar.jsx";
import {
  createUploadLinkedLocalFilePatch,
  mergeUploadIntoMetadata
} from "../features/upload/uploadLink.js";

function withKeyedChildren(props) {
  if (!Array.isArray(props?.children)) return props;
  // This file hand-authors JSX runtime calls; clone array children so React
  // treats each rendered sibling as an explicitly keyed element in dev tests.
  const children = React.Children.toArray(props.children).map((child, index) => (
    React.isValidElement(child)
      ? React.cloneElement(child, { key: child.key ?? `child-${index}` })
      : child
  ));
  return { ...props, children };
}

const jsx = (type, props, key) => runtimeJsx(type, withKeyedChildren(props), key);
const jsxs = (type, props, key) => runtimeJsx(type, withKeyedChildren(props), key);


const STEPS = [
  { id: "basic", label: "الأساسيات", detail: "العنوان والمسار أو الملف", icon: Video },
  { id: "classify", label: "التصنيف", detail: "النوع والفرع والوسوم", icon: Database },
  { id: "fields", label: "الحقول", detail: "حقول النوع المختار", icon: FileText },
  { id: "review", label: "المراجعة", detail: "تأكيد سريع قبل الحفظ", icon: Tags }
];

// Draft persistence: writes to localStorage on every change so a refresh,
// accidental navigation, or crash never loses in-progress data.
const DRAFT_STORAGE_KEY = "videoArchive:addVideoDraft";
const DRAFT_AUTO_SAVE_DELAY_MS = 600;

function readStoredDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistDraft(draft) {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function clearStoredDraft() {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

// Each step decides whether the user can advance forward. The basic step
// requires a title, the classify step a typeId, the fields step that all
// required custom fields are filled, and review is always advanceable
// (advancing = submitting).
function getStepErrors(stepId, snapshot) {
  const errors = [];
  if (stepId === "basic") {
    if (!snapshot.title.trim()) errors.push("أدخل عنوان الفيديو قبل المتابعة");
  }
  if (stepId === "classify") {
    if (!snapshot.typeId) errors.push("اختر نوع المحتوى");
  }
  if (stepId === "fields") {
    const missing = snapshot.fields.filter((field) => {
      if (!field.required) return false;
      const value = snapshot.metadata[fieldKey(field)];
      return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
    });
    if (missing.length) {
      errors.push(`أكمل الحقول المطلوبة: ${missing.map((field) => field.label).join("، ")}`);
    }
  }
  return errors;
}

function fieldKey(field) {
  return field.storageKey || field.name || field.id;
}

/**
 * Renders the "fields" entry step. When the type's custom fields carry group
 * names, they are split into tabs (one per group) so a type with many fields
 * stays scannable; otherwise a flat two-column grid is shown.
 */
function FieldsStep({ fields, metadata, onChange }) {
  const visibleFields = React.useMemo(() => getVisibleFields(fields, metadata), [fields, metadata]);
  const groups = React.useMemo(() => groupCustomFields(visibleFields), [visibleFields]);
  const [active, setActive] = React.useState(0);
  React.useEffect(() => { if (active >= groups.length) setActive(0); }, [groups.length, active]);

  if (!visibleFields.length) {
    return jsx("p", { className: "rounded-xl border border-dashed border-white/10 bg-gray-950/35 p-6 text-center text-sm text-gray-400", children: "لا توجد حقول مخصصة لهذا النوع." });
  }
  const tabbed = groups.length > 1;
  const visible = tabbed ? (groups[active]?.fields || []) : visibleFields;
  return jsxs("div", {
    className: "space-y-3",
    children: [
      tabbed ? jsx("div", { role: "tablist", className: "flex flex-wrap gap-1 overflow-x-auto rounded-xl va-surface-muted border p-1", children: groups.map((group, index) => jsxs("button", {
        type: "button",
        role: "tab",
        "aria-selected": active === index,
        onClick: () => setActive(index),
        className: `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active === index ? "va-accent-bg-soft va-accent-text-on-soft" : "text-gray-400 hover:bg-white/5 hover:text-white"}`,
        children: [group.name, jsx("span", { className: "rounded-full bg-white/10 px-1.5 text-[10px]", children: `${group.fields.length}` })]
      }, group.name)) }) : null,
      jsx("div", { className: "grid gap-4 md:grid-cols-2", children: visible.map((field) => jsx(FieldRow, { field, value: metadata[fieldKey(field)], onChange }, field.id)) })
    ]
  });
}

function LocalFilePicker({ value, onFileSelect, inputId }) {
  const file = normalizeLocalFileValue(value);
  const inputRef = React.useRef(null);
  const [dragActive, setDragActive] = React.useState(false);
  const readFile = (nextFile) => {
    if (nextFile) onFileSelect(nextFile);
  };
  return jsxs(motion.div, {
    whileHover: { y: -1 },
    className: `rounded-xl border border-dashed p-3 transition-colors ${dragActive ? "va-accent-border va-accent-bg-soft" : "border-white/10 bg-gray-950/35"}`,
    onDragOver: (event) => {
      event.preventDefault();
      setDragActive(true);
    },
    onDragLeave: () => setDragActive(false),
    onDrop: (event) => {
      event.preventDefault();
      setDragActive(false);
      readFile(event.dataTransfer?.files?.[0]);
    },
    children: [
    jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      jsxs("div", { className: "flex min-w-0 items-center gap-2 text-sm text-gray-300", children: [
        jsx(file ? HardDrive : UploadCloud, { className: "h-4 w-4 shrink-0 va-accent-text" }),
        jsx("span", { className: "truncate", children: file?.name || "لم يتم اختيار ملف" })
      ] }),
      jsx("button", { type: "button", onClick: () => inputRef.current?.click(), className: "btn btn-primary btn-sm", children: "استعراض" })
    ] }),
    !file && jsx("p", { className: "mt-2 text-xs leading-5 text-gray-500", children: "يمكنك سحب ملف فيديو هنا وسيتم ملء الاسم والمسار تلقائيًا قدر الإمكان." }),
    file && jsxs("div", { className: "mt-2 space-y-1 text-xs text-gray-600", children: [
      file.size > 0 && jsx("p", { children: formatFileSize(file.size) }),
      (file.relativePath || file.path) && jsx("p", { dir: "ltr", className: "truncate text-left", children: file.relativePath || file.path })
    ] }),
    jsx("input", {
      id: inputId,
      ref: inputRef,
      type: "file",
      "aria-label": "اختيار ملف محلي للفيديو",
      onChange: (event) => {
        readFile(event.target.files?.[0]);
        event.target.value = "";
      },
      style: { position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }
    })
  ] });
}

function FieldInput({ field, value, onChange, inputId }) {
  const key = fieldKey(field);
  const commonClass = "input input-bordered w-full";
  if (field.type === "textarea" || field.type === "transcript") {
    return jsx("textarea", { id: inputId, value: value || "", onChange: (event) => onChange(key, event.target.value), rows: 3, className: `${commonClass} p-3`, placeholder: field.placeholder || field.label });
  }
  if (field.type === "checkbox") {
    return jsxs("label", { className: "inline-flex min-h-11 items-center gap-2 va-surface-muted rounded-xl border px-3 text-sm text-gray-300", children: [
      jsx("input", { id: inputId, type: "checkbox", checked: !!value, onChange: (event) => onChange(key, event.target.checked) }),
      "نعم"
    ] });
  }
  if (field.type === "select" || field.type === "radio") {
    return jsxs("select", { id: inputId, value: value || "", onChange: (event) => onChange(key, event.target.value), className: commonClass, children: [
      jsx("option", { value: "", children: "اختر..." }, "empty"),
      ...(field.options || []).map((option) => jsx("option", { value: option, children: option }, option))
    ] });
  }
  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return jsx("select", {
      id: inputId,
      multiple: true,
      value: selected,
      onChange: (event) => onChange(key, Array.from(event.target.selectedOptions, (option) => option.value)),
      className: `${commonClass} min-h-28 py-2`,
      children: (field.options || []).map((option) => jsx("option", { value: option, children: option }, option))
    });
  }
  if (field.type === "tags") {
    return jsx("input", { id: inputId, value: Array.isArray(value) ? value.join("، ") : value || "", onChange: (event) => onChange(key, parseVideoTags(event.target.value)), className: commonClass, placeholder: "قيم مفصولة بفاصلة" });
  }
  if (field.type === "localFile") {
    return jsx(LocalFilePicker, { value, onFileSelect: (file) => onChange(key, createLocalFileValue(file)) });
  }
  if (field.type === "rating") {
    return jsx("div", { className: "flex min-h-11 items-center", children: jsx(StarRating, { value: Number(value) || 0, onChange: (val) => onChange(key, val) }) });
  }
  return jsx("input", { id: inputId, type: field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text", value: value || "", onChange: (event) => onChange(key, event.target.value), className: commonClass, placeholder: field.placeholder || field.label });
}

// Renders a custom-type field row with an explicit htmlFor/id binding so
// screen readers announce each control by its visible Arabic label.
function FieldRow({ field, value, onChange }) {
  const inputId = React.useId();
  const isWide = field.type === "textarea" || field.type === "localFile";
  return jsxs("div", {
    className: `space-y-1 text-sm text-gray-300 ${isWide ? "md:col-span-2" : ""}`,
    children: [
      jsxs("label", { htmlFor: inputId, className: "block", children: [
        field.label,
        field.required && jsx("span", { className: "text-red-300", children: " *" })
      ] }),
      jsx(FieldInput, { field, value, onChange, inputId }),
      field.description && jsx("span", { className: "text-xs text-gray-400", children: field.description })
    ]
  }, field.id);
}

function RequiredFieldSummary({ checks = [] }) {
  const missing = checks.filter((check) => !check.ok);
  return jsxs("div", {
    className: `rounded-xl border p-4 ${missing.length ? "border-amber-500/30 bg-amber-500/10" : "va-accent-border va-accent-bg-soft"}`,
    children: [
      jsxs("div", {
        className: "flex flex-wrap items-center justify-between gap-3",
        children: [
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              jsx(ClipboardCheck, { className: `h-4 w-4 ${missing.length ? "text-amber-200" : "va-accent-text-on-soft"}` }),
              jsx("h3", { className: "text-sm font-bold text-white", children: missing.length ? "قبل الحفظ، أكمل المطلوب" : "جاهز للحفظ" })
            ]
          }),
          jsx("span", {
            className: `rounded-full border px-2 py-0.5 text-[11px] ${missing.length ? "border-amber-400/30 text-amber-100" : "va-accent-border va-accent-text-on-soft"}`,
            children: missing.length ? `${missing.length} ناقص` : "مكتمل"
          })
        ]
      }),
      jsx("div", {
        className: "mt-3 grid gap-2 sm:grid-cols-2",
        children: checks.map((check) => jsxs("div", {
          className: `flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5 ${check.ok ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 bg-gray-950/30 text-gray-400"}`,
          children: [
            check.ok ? jsx(CheckCircle2, { className: "mt-0.5 h-3.5 w-3.5 shrink-0" }, "icon-ok") : jsx(Circle, { className: "mt-0.5 h-3.5 w-3.5 shrink-0" }, "icon-empty"),
            jsxs("span", {
              children: [
                jsx("span", { className: "font-semibold", children: check.label }, "label"),
                check.detail && jsx("span", { className: "block opacity-75", children: check.detail }, "detail")
              ]
            }, "body")
          ]
        }, check.id))
      })
    ]
  });
}

export function AddVideoPage() {
  const {
    contentTypes = [],
    addVideoItem,
    enqueueUploads,
    updateUpload,
    uploads = [],
    setCurrentPage,
    setSelectedItemId,
    showToast
  } = useAppStore();

  const firstType = contentTypes.find((type) => type.status !== "archived") || contentTypes[0];

  // Hydrate from any pending draft from a previous session so users
  // never lose progress to a refresh or accidental navigation.
  const initialDraft = React.useMemo(() => readStoredDraft(), []);
  const [stepIndex, setStepIndex] = React.useState(initialDraft?.stepIndex ?? 0);
  const [title, setTitle] = React.useState(initialDraft?.title ?? "");
  const [path, setPath] = React.useState(initialDraft?.path ?? "");
  const [thumbnail, setThumbnail] = React.useState(initialDraft?.thumbnail ?? "");
  const [notes, setNotes] = React.useState(initialDraft?.notes ?? "");
  const [tags, setTags] = React.useState(initialDraft?.tags ?? "");
  const [typeId, setTypeId] = React.useState(initialDraft?.typeId ?? firstType?.id ?? "");
  const [subtypeId, setSubtypeId] = React.useState(initialDraft?.subtypeId ?? "");
  const [metadata, setMetadata] = React.useState(initialDraft?.metadata ?? {});
  // Upload mode: "real" actually transfers the file blob; "metadata" only
  // extracts/records its details without uploading (§753).
  const [uploadMode, setUploadMode] = React.useState(initialDraft?.uploadMode ?? "real");
  // Archive the material immediately on save instead of leaving it active.
  const [archiveOnSave, setArchiveOnSave] = React.useState(initialDraft?.archiveOnSave ?? false);
  const [draftRestored, setDraftRestored] = React.useState(!!initialDraft);
  const [stepError, setStepError] = React.useState(null);
  const draftSave = useFormSaveState();
  const submitSave = useFormSaveState();

  const ai = useAiAssist({ showToast });
  const aiSuggestTags = async () => {
    const result = await ai.suggestTags(buildSuggestPayload({ title, notes, contentTypes }));
    if (!result) return;
    setTags((current) => mergeTagText(current, result.tags));
    showToast?.(result.tags?.length ? `أُضيفت ${result.tags.length} وسوم مقترحة` : "لا وسوم جديدة مقترحة", "success");
  };
  const aiSummarize = async () => {
    if (!hasSourceText({ title, notes })) { showToast?.("أضف ملاحظات أو عنوانًا أولاً للتلخيص.", "warning"); return; }
    const result = await ai.summarize(notes.trim() || title);
    if (!result) return;
    setNotes((current) => applySummaryToNotes(current, result.summary));
    setTags((current) => mergeTagText(current, result.tags));
    showToast?.("أُضيف ملخّص إلى الملاحظات", "success");
  };
  const aiProofread = async () => {
    if (!notes.trim()) { showToast?.("لا توجد ملاحظات لتدقيقها.", "warning"); return; }
    const result = await ai.proofread(notes);
    if (!result) return;
    setNotes((current) => applyProofread(current, result));
    const n = correctionsCount(result);
    showToast?.(n ? `تم التدقيق: ${n} تصحيح` : "لا أخطاء واضحة", "success");
  };

  // Explicit ids for each visible control so screen readers can
  // announce label+input pairs even when the layout splits them.
  const titleId = React.useId();
  const pathId = React.useId();
  const localFileId = React.useId();
  const thumbnailId = React.useId();
  const notesId = React.useId();
  const typeSelectId = React.useId();
  const subtypeSelectId = React.useId();
  const tagsId = React.useId();

  const selectedType = contentTypes.find((type) => type.id === typeId);
  const subtypes = selectedType?.subtypes || [];
  const fields = React.useMemo(() => getFieldsForSelection(contentTypes, typeId, subtypeId), [contentTypes, subtypeId, typeId]);
  const currentStep = STEPS[stepIndex];
  const canSave = title.trim() && typeId;
  const parsedTags = React.useMemo(() => parseVideoTags(tags), [tags]);
  const missingRequiredFields = React.useMemo(() => getMissingRequiredFields(fields, metadata), [fields, metadata]);
  const readyChecks = React.useMemo(() => [
    { id: "title", label: "عنوان واضح", ok: !!title.trim() },
    { id: "type", label: "تصنيف محدد", ok: !!typeId },
    { id: "source", label: "مصدر أو ملف", ok: !!(path.trim() || metadata.localFile) },
    { id: "fields", label: "حقول جاهزة", ok: missingRequiredFields.length === 0 }
  ], [metadata.localFile, missingRequiredFields.length, path, title, typeId]);
  const requiredChecks = React.useMemo(() => [
    { id: "title", label: "العنوان", detail: "مطلوب لتعريف المادة في الأرشيف.", ok: !!title.trim() },
    { id: "type", label: "نوع المحتوى", detail: "يحدد الحقول والقواعد المناسبة.", ok: !!typeId },
    ...fields.filter((field) => field.required).map((field) => {
      const value = metadata[fieldKey(field)];
      return {
        id: `field-${field.id}`,
        label: field.label,
        detail: "حقل مطلوب من نوع المحتوى.",
        ok: value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0)
      };
    })
  ], [fields, metadata, title, typeId]);
  const readyCount = readyChecks.filter((check) => check.ok).length;
  const readyPercent = Math.round((readyCount / readyChecks.length) * 100);
  const hasDraftContent = Boolean(title || path || thumbnail || notes || tags || subtypeId || Object.keys(metadata).length > 0);

  React.useEffect(() => {
    if (subtypeId && !subtypes.some((subtype) => subtype.id === subtypeId)) setSubtypeId("");
  }, [subtypeId, subtypes]);

  // Debounced auto-save of the current draft so a refresh or crash
  // never costs the user their in-progress work. We skip empty drafts
  // so we don't litter localStorage on first visit.
  React.useEffect(() => {
    if (!hasDraftContent) return undefined;
    const timer = window.setTimeout(() => {
      const ok = persistDraft({
        stepIndex, title, path, thumbnail, notes, tags, typeId, subtypeId, metadata,
        savedAt: new Date().toISOString()
      });
      if (ok) draftSave.succeed();
      else draftSave.fail(new Error("تعذّر حفظ المسودة محليًا"));
    }, DRAFT_AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draftSave, hasDraftContent, metadata, notes, path, stepIndex, subtypeId, tags, thumbnail, title, typeId]);

  // Surface a one-shot toast confirming the restored draft, then clear
  // the flag so it doesn't fire again on every re-render.
  React.useEffect(() => {
    if (draftRestored) {
      showToast?.("تمت استعادة مسودة سابقة", "info");
      setDraftRestored(false);
    }
  }, [draftRestored, showToast]);

  // Clear validation errors as soon as the user moves to a new step.
  React.useEffect(() => {
    setStepError(null);
  }, [stepIndex]);

  const updateMetadata = (key, value) => setMetadata((current) => ({ ...current, [key]: value }));
  const applyPrimaryLocalFile = (file) => {
    // Only enqueue a real transfer in "real" mode; "metadata" mode just records
    // the file's details (name/size/type) without uploading the blob.
    const entries = uploadMode === "real"
      ? (enqueueUploads?.([file], { source: "addVideoPage", fieldKey: "localFile" }) || [])
      : [];
    const patch = (entries[0]
      ? createUploadLinkedLocalFilePatch(file, { currentTitle: title, upload: entries[0] })
      : null) || createVideoLocalFilePatch(file, { currentTitle: title });
    if (!patch) return;
    if (patch.title) setTitle(patch.title);
    setPath(patch.path);
    setMetadata((current) => ({ ...current, ...patch.metadata }));
  };

  const save = async (addAnother = false) => {
    if (!canSave) return;
    const missingRequired = getMissingRequiredFields(fields, metadata);
    if (missingRequired.length) {
      setStepIndex(STEPS.findIndex((step) => step.id === "fields"));
      setStepError(`حقول مطلوبة فارغة: ${missingRequired.map((field) => field.label).join("، ")}`);
      showToast?.("أكمل الحقول المطلوبة قبل الحفظ.", "error");
      return;
    }
    const uploadId = metadata?.localFile?.uploadId;
    const linkedUpload = uploadId ? uploads.find((upload) => upload.id === uploadId) : null;
    const linkedMetadata = linkedUpload ? mergeUploadIntoMetadata(metadata, linkedUpload) : metadata;
    const item = createVideoItemValue({
      title,
      path,
      thumbnail,
      notes,
      tags,
      type: typeId,
      subtype: subtypeId,
      metadata: linkedMetadata,
      ...(archiveOnSave ? { status: "archived" } : {})
    });
    try {
      submitSave.begin();
      const savedItem = await addVideoItem?.(item);
      if (uploadId) {
        updateUpload?.(uploadId, { linkedItemId: (savedItem || item).id });
      }
      submitSave.succeed();
      // Successful submit invalidates the draft so the next AddVideo
      // visit starts clean.
      clearStoredDraft();
      showToast?.("تمت إضافة الفيديو", "success");
      if (addAnother) {
        setTitle("");
        setPath("");
        setThumbnail("");
        setNotes("");
        setTags("");
        setMetadata({});
        setStepIndex(0);
        return;
      }
      setSelectedItemId?.(item.id);
      setCurrentPage?.("detail");
    } catch (error) {
      submitSave.fail(error);
      showToast?.("تعذر إضافة الفيديو", "error");
    }
  };

  const tryAdvance = () => {
    const errors = getStepErrors(currentStep.id, { title, typeId, fields, metadata });
    if (errors.length) {
      setStepError(errors.join(" — "));
      return;
    }
    setStepError(null);
    setStepIndex((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const resetDraft = () => {
    clearStoredDraft();
    setTitle("");
    setPath("");
    setThumbnail("");
    setNotes("");
    setTags("");
    setTypeId(firstType?.id || "");
    setSubtypeId("");
    setMetadata({});
    setStepIndex(0);
    setStepError(null);
    draftSave.reset();
    showToast?.("تم مسح المسودة", "info");
  };

  const cancelEntry = () => {
    if (hasDraftContent) showToast?.("تم حفظ المسودة محلياً للعودة إليها لاحقاً.", "info");
    setCurrentPage?.("archive");
  };

  const [showTemplatePicker, setShowTemplatePicker] = React.useState(false);
  const [showQuickAdd, setShowQuickAdd] = React.useState(false);
  const incrementTemplateUsage = useAppStore((state) => state.incrementTemplateUsage);

  const applyTemplate = (template, resolved) => {
    if (resolved.title) setTitle(resolved.title);
    if (resolved.notes) setNotes(resolved.notes);
    if (Array.isArray(resolved.tags)) setTags(resolved.tags.join("، "));
    else if (resolved.tags) setTags(resolved.tags);
    if (resolved.type) {
      const matched = contentTypes.find(
        (t) => t.id === resolved.type || t.name?.toLowerCase() === String(resolved.type).toLowerCase()
      );
      if (matched) setTypeId(matched.id);
    }
    incrementTemplateUsage?.(template.id);
    showToast?.(`تم تطبيق قالب "${template.name}"`, "success");
  };

  const [showPanel, setShowPanel] = React.useState(() => {
    try { return localStorage.getItem("videoArchive:addVideoSidePanel") !== "0"; } catch (error) { return true; }
  });
  const toggleSidePanel = () => setShowPanel((value) => {
    const next = !value;
    try { localStorage.setItem("videoArchive:addVideoSidePanel", next ? "1" : "0"); } catch (error) { /* ignore */ }
    return next;
  });

  const renderActionBar = (className, key) => jsxs("div", { className, children: [
    jsxs("div", { className: "flex items-center gap-3", children: [
      jsxs("button", { type: "button", disabled: stepIndex <= 0, onClick: () => setStepIndex((value) => Math.max(0, value - 1)), className: "btn btn-ghost gap-2", children: [jsx(ChevronRight, { className: "h-4 w-4" }, "icon"), "السابق"] }, "previous"),
      jsx(SaveIndicator, {
        state: submitSave.state !== "idle" ? submitSave.state : draftSave.state,
        message: submitSave.state !== "idle"
          ? (submitSave.isSaving ? "يحفظ الفيديو..." : submitSave.isSaved ? "تم الحفظ" : "تعذر الحفظ")
          : (draftSave.isSaving ? "يحفظ المسودة..." : draftSave.isSaved ? "تم حفظ المسودة" : null)
      }, "save-indicator")
    ] }, "save-status"),
    jsxs("div", { className: "flex flex-wrap gap-2", children: [
      jsx("button", { type: "button", onClick: cancelEntry, className: "rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5", children: "إلغاء" }, "cancel"),
      jsx("button", { type: "button", onClick: resetDraft, className: "rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5", title: "مسح المسودة المحفوظة محليًا", children: "إعادة تعيين" }, "reset"),
      stepIndex < STEPS.length - 1 && jsxs("button", { type: "button", onClick: tryAdvance, className: "btn btn-primary gap-2", children: ["التالي", jsx(ChevronLeft, { className: "h-4 w-4" }, "icon")] }, "next"),
      stepIndex === STEPS.length - 1 && jsx("button", { type: "button", disabled: !canSave || submitSave.isSaving, onClick: () => save(false), className: "btn btn-primary", children: "حفظ وفتح التفاصيل" }, "save-open"),
      stepIndex === STEPS.length - 1 && jsx("button", { type: "button", disabled: !canSave || submitSave.isSaving, onClick: () => save(true), className: "btn btn-ghost", children: "حفظ وإضافة آخر" }, "save-another")
    ] }, "actions")
  ] }, key);

  const mobileActionBar = typeof document !== "undefined"
    ? createPortal(renderActionBar("fixed inset-x-4 bottom-24 z-[9991] flex flex-wrap items-center justify-between gap-3 va-control-surface va-surface-muted rounded-2xl border p-3 shadow-2xl shadow-black/20 md:hidden", "mobile-action-bar-surface"), document.body, "mobile-action-bar")
    : null;

  return jsxs(React.Fragment, {
    children: [jsxs(MotionPage, {
    className: "space-y-6 p-4 pb-40 sm:p-6 md:pb-6",
    children: [
      jsx(PageHero, {
        icon: jsx(Video, { className: "h-6 w-6 va-accent-text" }, "hero-icon"),
        title: "إضافة فيديو",
        description: "نموذج متعدد الخطوات لإضافة مادة أرشيفية بدون عرض كل الحقول دفعة واحدة.",
        children: jsxs("div", {
          className: "mt-5 space-y-3",
          children: [
            jsxs("div", {
              className: "rounded-xl border border-white/10 bg-white/[0.03] p-3 md:hidden",
              children: [
                jsxs("div", {
                  className: "flex items-center justify-between gap-3",
                  children: [
                    jsxs("div", {
                      className: "min-w-0",
                      children: [
                        jsx("p", { className: "text-[11px] text-gray-500", children: `الخطوة ${stepIndex + 1} من ${STEPS.length}` }),
                        jsx("h2", { className: "mt-1 truncate text-base font-bold text-white", children: currentStep.label })
                      ]
                    }),
                    jsx(currentStep.icon, { className: "h-5 w-5 shrink-0 va-accent-text" })
                  ]
                }),
                jsx("p", { className: "mt-2 text-xs leading-6 text-gray-500", children: currentStep.detail }),
                jsx("div", {
                  className: "mt-3 grid grid-cols-4 gap-1",
                  "aria-hidden": true,
                  children: STEPS.map((step, index) => jsx("span", {
                    className: `h-1.5 rounded-full ${index <= stepIndex ? "va-accent-bg" : "bg-white/10"}`
                  }, step.id))
                })
              ]
            }, "mobile-stepper"),
            jsx("div", {
              className: "hidden md:block",
              children: jsx(WorkflowStepper, {
                steps: STEPS,
                activeStepId: currentStep.id,
                completedStepIds: STEPS.slice(0, stepIndex).map((step) => step.id),
                onStepClick: (stepId) => setStepIndex(Math.max(0, STEPS.findIndex((step) => step.id === stepId))),
                className: "sm:grid-cols-4",
                compact: true
              })
            }, "desktop-stepper")
          ]
        }, "hero-body")
      }, "page-hero"),
      jsxs("div", {
        className: `grid gap-5 ${showPanel ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`,
        children: [
          jsxs("div", { className: "min-w-0 space-y-4", children: [
      jsxs("section", { className: "va-card rounded-2xl va-surface-muted border p-5 text-right", children: [
        jsxs("div", { className: "mb-4 flex items-center justify-between gap-3", children: [
          jsx("h2", { className: "text-lg font-bold text-white", children: currentStep.label }),
          jsxs("button", {
            type: "button",
            onClick: toggleSidePanel,
            "aria-pressed": showPanel,
            title: showPanel ? "إخفاء اللوحة الجانبية" : "إظهار اللوحة الجانبية",
            className: "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-white",
            children: [jsx(Eye, { className: "h-3.5 w-3.5" }), showPanel ? "إخفاء اللوحة" : "إظهار اللوحة"]
          })
        ] }),
        currentStep.id === "basic" && jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [
          jsx("div", { className: "md:col-span-2 flex flex-wrap gap-2", children: [
            jsx("button", { type: "button", onClick: () => setShowTemplatePicker(true), className: "inline-flex items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-2 text-sm text-gray-400 transition-colors hover:border-white/25 hover:text-white", children: [jsx(Sparkles, { className: "h-4 w-4 va-accent-text", "aria-hidden": "true" }, "icon"), "تطبيق قالب"] }),
            jsx("button", { type: "button", onClick: () => setShowQuickAdd(v => !v), className: "inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-500/20 px-4 py-2 text-sm text-emerald-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-300", children: [jsx("span", { className: "text-base leading-none", children: "⚡" }, "icon"), "إضافة سريعة"] })
          ] }),
          jsxs("div", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [jsx("label", { htmlFor: titleId, className: "block", children: "العنوان" }), jsx("input", { id: titleId, value: title, onChange: (event) => setTitle(event.target.value), className: "input input-bordered w-full", placeholder: "عنوان الفيديو" })] }),
          jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [jsx("label", { htmlFor: pathId, className: "block", children: "الرابط أو المسار" }), jsx("input", { id: pathId, value: path, onChange: (event) => setPath(event.target.value), dir: "ltr", className: "input input-bordered w-full", placeholder: "https:// أو D:\\..." })] }),
          jsxs("div", { className: "space-y-2 text-sm text-gray-300 md:col-span-2", children: [
            jsx("label", { htmlFor: localFileId, className: "block", children: "ملف محلي من الجهاز" }),
            jsxs("div", { className: "flex flex-wrap gap-2", role: "radiogroup", "aria-label": "وضع الرفع", children: [
              jsxs("label", { className: `inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 ${uploadMode === "real" ? "border-emerald-500/40 text-white" : "border-white/10 text-gray-400"}`, children: [
                jsx("input", { type: "radio", name: "uploadMode", checked: uploadMode === "real", onChange: () => setUploadMode("real"), className: "accent-emerald-500" }), "رفع فعلي للملف"
              ] }),
              jsxs("label", { className: `inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 ${uploadMode === "metadata" ? "border-emerald-500/40 text-white" : "border-white/10 text-gray-400"}`, children: [
                jsx("input", { type: "radio", name: "uploadMode", checked: uploadMode === "metadata", onChange: () => setUploadMode("metadata"), className: "accent-emerald-500" }), "استخراج البيانات فقط"
              ] })
            ] }),
            jsx(LocalFilePicker, { value: metadata.localFile, onFileSelect: applyPrimaryLocalFile, inputId: localFileId }),
            jsxs("label", { className: "inline-flex cursor-pointer items-center gap-2 text-gray-300", children: [
              jsx("input", { type: "checkbox", checked: archiveOnSave, onChange: (event) => setArchiveOnSave(event.target.checked), className: "accent-emerald-500" }),
              "أرشفة المادة المرفوعة مباشرة"
            ] })
          ] }),
          jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [jsx("label", { htmlFor: thumbnailId, className: "block", children: "الصورة المصغرة" }), jsx("input", { id: thumbnailId, value: thumbnail, onChange: (event) => setThumbnail(event.target.value), dir: "ltr", className: "input input-bordered w-full", placeholder: "رابط صورة اختياري" })] }),
          jsxs("div", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [jsx("label", { htmlFor: notesId, className: "block", children: "ملاحظات" }), jsx("textarea", { id: notesId, value: notes, onChange: (event) => setNotes(event.target.value), className: "textarea textarea-bordered w-full", placeholder: "ملخص أو ملاحظات أرشيفية" })] }),
          ai.available && jsx("div", { className: "md:col-span-2", children: jsx(AiAssistBar, { available: ai.available, busy: ai.busy, onSummarize: aiSummarize, onSuggestTags: aiSuggestTags, onProofread: aiProofread }) })
        ] }, "basic-step"),
        currentStep.id === "classify" && jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [
          jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [jsx("label", { htmlFor: typeSelectId, className: "block", children: "نوع المحتوى" }), jsxs("select", { id: typeSelectId, value: typeId, onChange: (event) => setTypeId(event.target.value), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none", children: contentTypes.filter((type) => type.status !== "archived").map((type) => jsx("option", { value: type.id, children: type.name }, type.id)) })] }),
          jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [jsx("label", { htmlFor: subtypeSelectId, className: "block", children: "الفرع" }), jsxs("select", { id: subtypeSelectId, value: subtypeId, onChange: (event) => setSubtypeId(event.target.value), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none", children: [jsx("option", { value: "", children: "بدون فرع" }, "empty"), ...subtypes.map((subtype) => jsx("option", { value: subtype.id, children: subtype.name }, subtype.id))] })] }),
          jsxs("div", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [jsx("label", { htmlFor: tagsId, className: "block", children: "الوسوم" }), jsx(TagAutocomplete, { id: tagsId, value: tags, onChange: setTags, placeholder: "وسوم مفصولة بفاصلة، ويمكن استخدام مسارات الوسوم الهرمية", allowed: ["tags", "vocabulary"] })] })
        ] }, "classify-step"),
        currentStep.id === "fields" && jsx(FieldsStep, { fields, metadata, onChange: updateMetadata }, "fields-step"),
        currentStep.id === "review" && jsxs("div", {
          className: "space-y-3",
          children: [
            jsx(RequiredFieldSummary, { checks: requiredChecks }),
            jsx("div", { className: "grid gap-3 md:grid-cols-2", children: [
              ["العنوان", title || "غير محدد"],
              ["التصنيف", [selectedType?.name, subtypes.find((s) => s.id === subtypeId)?.name].filter(Boolean).join(" / ") || "غير محدد"],
              ["المصدر", path || metadata?.localFile?.name || "غير محدد"],
              ["الوسوم", parsedTags.length ? `${parsedTags.length} وسم` : "لا توجد"],
              ["الملاحظات", notes || "—"],
              ["حقول مخصصة", Object.keys(metadata).filter((k) => k !== "localFile").length ? `${Object.keys(metadata).filter((k) => k !== "localFile").length} حقل` : "لا توجد"]
            ].map(([label, value]) => jsxs("div", { className: "va-surface-muted rounded-xl border p-3", children: [
              jsx("p", { className: "text-xs text-gray-500", children: label }, "label"),
              jsx("p", { className: "mt-1 truncate text-sm font-semibold text-white", title: value, children: value }, "value")
            ] }, label)) })
          ]
        }, "review-step")
      ] }),
      stepError && jsx("div", { role: "alert", className: "rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200", children: stepError }, "step-error"),
      renderActionBar("hidden items-center justify-between gap-3 va-control-surface va-surface-muted rounded-2xl border p-3 md:flex", "desktop-action-bar")
          ]
          }, "form-column"),
          showPanel && jsxs("aside", {
            className: "min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start",
            children: [
              jsxs("div", { className: "va-card rounded-2xl va-surface-muted border p-4 text-right", children: [
                jsxs("div", { className: "flex items-center justify-between gap-3", children: [
                  jsxs("div", { className: "flex items-center gap-2", children: [
                    jsx(ClipboardCheck, { className: "h-5 w-5 va-accent-text" }),
                    jsx("h2", { className: "text-sm font-bold text-white", children: "جاهزية الحفظ" })
                  ] }),
                  jsx("span", { dir: "ltr", className: "font-mono text-sm va-accent-text-on-soft", children: `${readyPercent}%` })
                ] }),
                jsx("div", { className: "mt-3 h-2 overflow-hidden rounded-full bg-white/10", dir: "rtl", children: jsx(motion.div, { className: "h-full rounded-full va-accent-bg", initial: false, animate: { width: `${readyPercent}%` }, transition: { duration: 0.28 } }) }),
                jsx("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: readyChecks.map((check) => jsxs("span", { className: `inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${check.ok ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 bg-gray-950/35 text-gray-500"}`, children: [
                  check.ok ? jsx(CheckCircle2, { className: "h-3.5 w-3.5" }, "icon-ok") : jsx(Circle, { className: "h-3.5 w-3.5" }, "icon-empty"),
                  check.label
                ] }, check.id)) })
              ] }, "readiness-card"),
              jsxs("div", { className: "va-card rounded-2xl va-surface-muted border p-4 text-right", children: [
                jsxs("div", { className: "flex items-center gap-2", children: [
                  jsx(Sparkles, { className: "h-5 w-5 text-amber-300" }),
                  jsx("h2", { className: "text-sm font-bold text-white", children: "ملخص مباشر" })
                ] }),
                jsx("div", { className: "mt-3 grid gap-2 text-sm text-gray-400", children: [
                  ["العنوان", title || "بانتظار الإدخال"],
                  ["التصنيف", selectedType?.name || "غير محدد"],
                  ["الوسوم", parsedTags.length ? `${parsedTags.length} وسم` : "لا توجد"],
                  ["المصدر", path || metadata.localFile?.name || "غير محدد"]
                ].map(([label, value]) => jsxs("div", { className: "flex items-center justify-between gap-3 rounded-xl va-surface-subtle border px-3 py-2", children: [
                  jsx("span", { className: "text-gray-500", children: label }, "label"),
                  jsx("span", { className: "min-w-0 truncate text-gray-200", children: value }, "value")
                ] }, label)) })
              ] }, "summary-card"),
              jsxs("div", { className: "va-card rounded-2xl va-surface-muted border p-4 text-right", children: [
                jsxs("div", { className: "flex items-center gap-2", children: [
                  jsx(Eye, { className: "h-5 w-5 text-cyan-300" }),
                  jsx("h2", { className: "text-sm font-bold text-white", children: "الخطوة الحالية" })
                ] }),
                jsx("p", { className: "mt-3 text-lg font-bold text-white", children: currentStep.label }),
                jsx("p", { className: "mt-1 text-sm leading-7 text-gray-500", children: currentStep.detail }),
                jsx("p", { className: "mt-3 rounded-xl va-surface-subtle border p-3 text-xs leading-6 text-gray-500", children: stepIndex === STEPS.length - 1 ? "راجع الملخص ثم احفظ، أو استخدم حفظ وإضافة آخر للعمل المتكرر." : "يمكنك الانتقال بين الخطوات بحرية؛ لن يتم الحفظ إلا من خطوة المراجعة." })
              ] }, "current-step-card")
            ]
          }, "side-panel")
        ]
      }, "content-grid")
    ]
    }, "motion-page"), mobileActionBar,
    jsx(TemplatePicker, {
      isOpen: showTemplatePicker,
      onClose: () => setShowTemplatePicker(false),
      onApply: applyTemplate,
      context: { counter: 0, lastValues: {} }
    }, "template-picker"),
    showQuickAdd && jsx("div", {
      className: "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl sm:inset-x-6 sm:bottom-6",
      children: jsx(QuickAddBar, {
        contentTypes,
        defaultTypeId: typeId,
        onDone: (count) => { setShowQuickAdd(false); showToast?.(`تمت إضافة ${count} عنصر`, "success"); },
        onClose: () => setShowQuickAdd(false)
      })
    }, "quick-add")
  ] });
}

AddVideoPage.pageId = "add";
AddVideoPage.migrationStatus = "native";

export default AddVideoPage;
