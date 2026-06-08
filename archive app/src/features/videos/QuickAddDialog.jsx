import { BookOpen, Briefcase, FolderPlus, Hash, ListPlus, MessageSquarePlus, Sparkles, Tags, Video } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { EntityFormModal } from "../../components/common/EntityFormModal.jsx";
import { useAsyncAction } from "../../hooks/useAsyncAction.js";
import { useAppStore } from "../../stores/index.js";
import { ACTIONS, canPerform } from "../users/permissions.js";
import { createVirtualCollectionValue } from "../collections/viewModel.js";
import { createHierarchicalTagValue } from "../hierarchical-tags/viewModel.js";
import { addProjectTask, createProjectValue } from "../projects/viewModel.js";
import { createContentTypeValue, createCustomFieldValue, suggestSafeTypeSlug } from "../types/viewModel.js";
import { createVocabularyEntryValue, parseVocabularyAliases } from "../vocabulary/viewModel.js";
import { createVideoItemValue, parseVideoTags } from "./viewModel.js";
import { reportError } from "../../utils/errorReporting.js";
import { AutoTagSuggestions } from "../../components/upload/AutoTagSuggestions.jsx";
import { getCloudToken } from "../../bootstrap/cloudSession.js";

const DRAFT_KEY = "videoArchive:quickAddDraft";

const MODE_META = {
  video: { label: "مادة", title: "إضافة مادة", icon: Video, action: ACTIONS.VIDEO_CREATE, page: "detail", primary: "حفظ المادة" },
  type: { label: "نوع", title: "إنشاء نوع محتوى", icon: Tags, action: ACTIONS.TYPES_MANAGE, page: "types", primary: "حفظ النوع" },
  field: { label: "حقل", title: "إضافة حقل لنوع", icon: ListPlus, action: ACTIONS.TYPES_MANAGE, page: "types", primary: "حفظ الحقل" },
  term: { label: "مصطلح", title: "إضافة مصطلح", icon: BookOpen, action: ACTIONS.VOCABULARY_MANAGE, page: "vocabulary", primary: "حفظ المصطلح" },
  tag: { label: "وسم", title: "إضافة وسم", icon: Hash, action: ACTIONS.HTAGS_MANAGE, page: "htags", primary: "حفظ الوسم" },
  collection: { label: "مجموعة", title: "إنشاء مجموعة", icon: FolderPlus, action: ACTIONS.COLLECTIONS_MANAGE, page: "collections", primary: "حفظ المجموعة" },
  project: { label: "مشروع", title: "إنشاء مشروع", icon: Briefcase, action: null, page: "projects", primary: "حفظ المشروع" },
  task: { label: "مهمة", title: "إضافة مهمة لآخر مشروع", icon: ListPlus, action: null, page: "projects", primary: "حفظ المهمة" },
  comment: { label: "تعليق", title: "تعليق على آخر مادة", icon: MessageSquarePlus, action: ACTIONS.COMMENT_CREATE, page: "detail", primary: "حفظ التعليق" }
};

function readDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function writeDraft(draft) {
  try {
    const hasContent = [draft.name, draft.description, draft.tagsText].some((value) => String(value || "").trim());
    if (!hasContent) window.localStorage.removeItem(DRAFT_KEY);
    else window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    // local draft is a convenience only.
  }
}

function getLatestItem(videoItems = [], selectedItemId = "") {
  const selected = videoItems.find((item) => item.id === selectedItemId && !item.isDeleted);
  if (selected) return selected;
  return [...videoItems]
    .filter((item) => !item.isDeleted)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())[0] || null;
}

function getLatestProject(projects = []) {
  return [...projects]
    .filter((project) => project.status !== "archived")
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())[0] || null;
}

function defaultModeForPage(page) {
  if (page === "types") return "type";
  if (page === "vocabulary") return "term";
  if (page === "htags") return "tag";
  if (page === "collections") return "collection";
  if (page === "projects") return "project";
  if (page === "detail") return "comment";
  return "video";
}

export function QuickAddDialog({ open, onOpenChange }) {
  const {
    currentPage,
    selectedItemId,
    currentUser,
    contentTypes = [],
    videoItems = [],
    projects = [],
    addVideoItem,
    addContentType,
    updateContentType,
    addVocabularyEntry,
    addHierarchicalTag,
    addVirtualCollection,
    addProject,
    updateProject,
    addItemComment,
    setCurrentPage,
    setSelectedItemId,
    hasPermission,
    showToast,
    showNotification
  } = useAppStore();

  const action = useAsyncAction({ label: "إنشاء سريع" });
  const activeTypes = React.useMemo(() => contentTypes.filter((type) => type.status !== "archived"), [contentTypes]);
  const latestItem = React.useMemo(() => getLatestItem(videoItems, selectedItemId), [selectedItemId, videoItems]);
  const latestProject = React.useMemo(() => getLatestProject(projects), [projects]);
  const canWorkflow = currentUser?.role === "admin" || currentUser?.role === "editor";
  const canUseAction = React.useCallback((permissionAction) => {
    if (!permissionAction) return true;
    return typeof hasPermission === "function"
      ? hasPermission(permissionAction)
      : canPerform(currentUser, permissionAction);
  }, [currentUser, hasPermission]);

  const availableModes = React.useMemo(() => Object.entries(MODE_META)
    .filter(([id, meta]) => {
      if (!canUseAction(meta.action)) return false;
      if ((id === "project" || id === "task") && !canWorkflow) return false;
      if (id === "field" && activeTypes.length === 0) return false;
      if (id === "task" && !latestProject) return false;
      if (id === "comment" && !latestItem) return false;
      return true;
    })
    .map(([id, meta]) => ({ id, ...meta })), [activeTypes.length, canUseAction, canWorkflow, latestItem, latestProject]);

  const [mode, setMode] = React.useState("video");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [tagsText, setTagsText] = React.useState("");
  const [typeId, setTypeId] = React.useState("");
  const [targetTypeId, setTargetTypeId] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const saved = readDraft();
    const fallback = defaultModeForPage(currentPage);
    const nextMode = availableModes.some((item) => item.id === saved?.mode)
      ? saved.mode
      : availableModes.some((item) => item.id === fallback)
        ? fallback
        : availableModes[0]?.id || "video";
    setMode(nextMode);
    setName(saved?.name || "");
    setDescription(saved?.description || "");
    setTagsText(saved?.tagsText || "");
    setTypeId(saved?.typeId || activeTypes[0]?.id || "");
    setTargetTypeId(saved?.targetTypeId || activeTypes[0]?.id || "");
  }, [activeTypes, availableModes, currentPage, open]);

  React.useEffect(() => {
    if (!open) return;
    if (!availableModes.some((item) => item.id === mode) && availableModes[0]) setMode(availableModes[0].id);
  }, [availableModes, mode, open]);

  React.useEffect(() => {
    if (!open) return;
    writeDraft({ mode, name, description, tagsText, typeId, targetTypeId });
  }, [description, mode, name, open, tagsText, targetTypeId, typeId]);

  if (!open) return null;

  const meta = MODE_META[mode] || MODE_META.video;
  const Icon = meta.icon || Sparkles;
  const isComment = mode === "comment";
  const canSubmit = Boolean((isComment ? description || name : name).trim()) && !action.busy && availableModes.length > 0;
  const activeType = activeTypes.find((type) => type.id === targetTypeId) || activeTypes[0];

  const resetDraft = () => {
    setName("");
    setDescription("");
    setTagsText("");
    writeDraft({ mode, typeId, targetTypeId, name: "", description: "", tagsText: "" });
  };

  const openCreated = (created) => {
    const page = meta.page;
    if (mode === "video" && created?.id) {
      setSelectedItemId?.(created.id);
      setCurrentPage?.("detail");
      return;
    }
    if (mode === "comment" && latestItem?.id) {
      setSelectedItemId?.(latestItem.id);
      setCurrentPage?.("detail");
      return;
    }
    setSelectedItemId?.(null);
    if (page) setCurrentPage?.(page);
  };

  const createEntity = async () => {
    const title = name.trim();
    const detail = description.trim();
    if (mode === "video") {
      return addVideoItem?.(createVideoItemValue({ title, type: typeId, tags: parseVideoTags(tagsText), notes: detail }));
    }
    if (mode === "type") {
      return addContentType?.(createContentTypeValue({ name: title, nameEn: suggestSafeTypeSlug(title), icon: "📁", color: "#10b981" }));
    }
    if (mode === "field") {
      if (!activeType) throw new Error("اختر نوع محتوى قبل إضافة الحقل.");
      const field = createCustomFieldValue({ label: title, storageKey: suggestSafeTypeSlug(title).replace(/-/g, "_"), type: "text", order: activeType.fields?.length || 0 });
      return updateContentType?.({ ...activeType, fields: [...(activeType.fields || []), field] });
    }
    if (mode === "term") {
      return addVocabularyEntry?.(createVocabularyEntryValue({ term: title, description: detail, aliases: parseVocabularyAliases(tagsText) }));
    }
    if (mode === "tag") {
      return addHierarchicalTag?.(createHierarchicalTagValue({ name: title }));
    }
    if (mode === "collection") {
      return addVirtualCollection?.(createVirtualCollectionValue({ name: title, description: detail }));
    }
    if (mode === "project") {
      return addProject?.(createProjectValue({ name: title, description: detail }));
    }
    if (mode === "task") {
      if (!latestProject) throw new Error("لا يوجد مشروع نشط لإضافة المهمة.");
      return updateProject?.(addProjectTask(latestProject, { title, notes: detail }));
    }
    if (mode === "comment") {
      if (!latestItem) throw new Error("لا توجد مادة حديثة لإضافة تعليق.");
      return addItemComment?.(latestItem.id, detail || title);
    }
    return null;
  };

  const submit = async (next = "close") => action.run(async () => {
    try {
      const created = await createEntity();
      showToast?.(`تم إنشاء ${meta.label}`, "success");
      if (next === "another") {
        resetDraft();
        return created;
      }
      resetDraft();
      onOpenChange?.(false);
      if (next === "open") openCreated(created);
      return created;
    } catch (error) {
      reportError(showNotification, error, {
        context: meta.title,
        recovery: { label: "إعادة المحاولة", run: () => submit(next) }
      });
      return null;
    }
  }, { label: meta.title });

  return jsx(EntityFormModal, {
    title: "إنشاء سريع",
    icon: jsx(Sparkles, { className: "h-4 w-4" }),
    onCancel: () => onOpenChange?.(false),
    onSubmit: () => submit("close"),
    onSubmitAndNew: () => submit("another"),
    onSubmitAndOpen: () => submit("open"),
    canSubmit,
    submitLabel: action.busy ? "يحفظ..." : meta.primary,
    submitAndOpenLabel: "حفظ وفتح",
    size: "xl",
    children: jsxs("div", { className: "space-y-4", children: [
      availableModes.length ? jsx("div", { className: "flex flex-wrap gap-2", role: "tablist", "aria-label": "نوع العنصر المراد إنشاؤه", children: availableModes.map((item) => {
        const ModeIcon = item.icon;
        const active = item.id === mode;
        return jsxs("button", {
          type: "button",
          role: "tab",
          "aria-selected": active,
          onClick: () => setMode(item.id),
          className: `inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${active ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"}`,
          children: [jsx(ModeIcon, { className: "h-4 w-4" }), item.label]
        }, item.id);
      }) }) : jsx("p", { className: "rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100", children: "لا توجد أوامر إنشاء متاحة لصلاحيتك الحالية." }),
      jsxs("section", { className: "rounded-2xl va-surface-subtle border p-4", children: [
        jsxs("div", { className: "mb-3 flex items-center gap-2", children: [
          jsx("span", { className: "flex h-8 w-8 items-center justify-center rounded-lg border va-accent-border va-accent-bg-soft va-accent-text-on-soft", children: jsx(Icon, { className: "h-4 w-4" }) }),
          jsxs("div", { children: [
            jsx("h3", { className: "text-sm font-bold text-white", children: meta.title }),
            mode === "comment" && latestItem ? jsx("p", { className: "text-xs text-gray-500", children: `على: ${latestItem.title || "آخر مادة"}` }) : null,
            mode === "task" && latestProject ? jsx("p", { className: "text-xs text-gray-500", children: `داخل: ${latestProject.name || "آخر مشروع"}` }) : null
          ] })
        ] }),
        mode === "field" && activeTypes.length ? jsxs("label", { className: "mb-3 block space-y-1 text-sm text-gray-300", children: [
          jsx("span", { children: "نوع المحتوى المستهدف" }),
          jsx("select", { value: targetTypeId, onChange: (event) => setTargetTypeId(event.target.value), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none", children: activeTypes.map((type) => jsx("option", { value: type.id, children: type.name }, type.id)) })
        ] }) : null,
        mode === "video" && activeTypes.length ? jsxs("label", { className: "mb-3 block space-y-1 text-sm text-gray-300", children: [
          jsx("span", { children: "نوع المادة" }),
          jsxs("select", { value: typeId, onChange: (event) => setTypeId(event.target.value), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none", children: [
            jsx("option", { value: "", children: "بدون نوع" }),
            ...activeTypes.map((type) => jsx("option", { value: type.id, children: type.name }, type.id))
          ] })
        ] }) : null,
        !isComment ? jsxs("label", { className: "block space-y-1 text-sm text-gray-300", children: [
          jsx("span", { children: mode === "field" ? "اسم الحقل" : mode === "term" ? "المصطلح" : mode === "tag" ? "اسم الوسم" : "الاسم" }),
          jsx("input", { "data-autofocus": true, value: name, onChange: (event) => setName(event.target.value), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none", placeholder: mode === "video" ? "عنوان المادة" : "اسم واضح وقصير" })
        ] }) : null,
        isComment ? jsxs("label", { className: "block space-y-1 text-sm text-gray-300", children: [
          jsx("span", { children: "نص التعليق" }),
          jsx("textarea", { "data-autofocus": true, value: description, onChange: (event) => setDescription(event.target.value), rows: 3, className: "w-full va-surface-deep rounded-xl border p-3 text-sm text-white outline-none", placeholder: "اكتب التعليق..." })
        ] }) : mode !== "field" && mode !== "tag" ? jsxs("label", { className: "mt-3 block space-y-1 text-sm text-gray-300", children: [
          jsx("span", { children: mode === "video" ? "ملاحظات" : "وصف مختصر" }),
          jsx("textarea", { value: description, onChange: (event) => setDescription(event.target.value), rows: 2, className: "w-full va-surface-deep rounded-xl border p-3 text-sm text-white outline-none", placeholder: "اختياري" })
        ] }) : null,
        (mode === "video" || mode === "term") ? jsxs("label", { className: "mt-3 block space-y-1 text-sm text-gray-300", children: [
          jsx("span", { children: mode === "video" ? "وسوم" : "مرادفات" }),
          jsx("input", { value: tagsText, onChange: (event) => setTagsText(event.target.value), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none", placeholder: mode === "video" ? "مفصولة بفواصل" : "مرادفات مفصولة بفواصل" })
        ] }) : null,
        mode === "video"
          ? jsx(AutoTagSuggestions, {
              name,
              summary: description,
              categories: activeTypes,
              authToken: getCloudToken(),
              onAccept: (tag) => setTagsText((prev) => {
                const existing = prev.trim();
                return existing ? `${existing}، ${tag}` : tag;
              })
            })
          : null
      ] }),
      jsx("p", { className: "text-xs leading-6 text-gray-500", children: "المسودة تحفظ محليًا أثناء الكتابة. استخدم حفظ وفتح للانتقال إلى الصفحة المناسبة بعد الإنشاء." })
    ] })
  });
}

export default QuickAddDialog;
