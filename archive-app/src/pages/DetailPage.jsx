import {
  useAppStore
} from "../stores/index.js";
import {
  AlertTriangle,
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileText,
  Gauge,
  HardDrive,
  History,
  Image as ImageIcon,
  Info,
  Loader2,
  MessageSquare,
  Music,
  StickyNote,
  PenLine,
  Play,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Tags,
  Trash2,
  Video
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { appConfirm } from "../components/common/ConfirmDialog.js";
import { DetailNavigationPanel } from "../components/navigation/DetailNavigationPanel.jsx";
import { getItemPosition, resolveAdjacentItem } from "../features/navigation/navigationContext.js";
import { TagAutocomplete } from "../components/forms/TagAutocomplete.jsx";
import { ArchiveImprovementSuggestions } from "../components/recommendations/ArchiveImprovementSuggestions.jsx";
import { RelatedContentPanel } from "../components/recommendations/RelatedContentPanel.jsx";
import { MobileActionBar, MotionPage, ResponsiveTabs, UXEmptyState } from "../components/ui/index.js";
import { RecordVersionHistory } from "../components/records/RecordVersionHistory.jsx";
import { AddRelationDialog } from "../components/relations/AddRelationDialog.jsx";
import { RelationsPanel } from "../components/relations/RelationsPanel.jsx";
import { ItemNotesPanel } from "../components/itemNotes/ItemNotesPanel.jsx";
import { StatusTransitionMenu } from "../components/workflow/StatusTransitionMenu.jsx";
import { AutosaveIndicator } from "../components/autosave/AutosaveIndicator.jsx";
import { DraftRecoveryDialog } from "../components/autosave/DraftRecoveryDialog.jsx";
import { createAutosaveEngine } from "../features/autosave/autosaveEngine.js";
import { isDraftExpired } from "../features/autosave/viewModel.js";
import { reportError } from "../utils/errorReporting.js";
import {
  MEDIA_PREVIEW_STATUS,
  getMediaPreviewDescriptor
} from "../features/archive/mediaPreview.js";
import { getFieldsForSelection, groupCustomFields, getVisibleFields, getMissingRequiredFields } from "../features/types/viewModel.js";
import { StarRating } from "../components/common/StarRating.jsx";
import { VideoPlayer } from "../components/media/VideoPlayer.jsx";
import { parseSubtitles, segmentsToCues } from "../features/media/subtitleParser.js";
import { transcriptToSrt } from "../features/media/transcriptToSrt.js";
import { computeCompleteness, COMPLETENESS_TIERS } from "../features/archive/completeness.js";
import { getItemImprovementSuggestions, getRelatedItems } from "../features/archive/relatedItems.js";
import { getItemRelations } from "../features/relations/viewModel.js";
import { parseTimestampSegments, hasTimestamps } from "../features/archive/timestampLinks.js";
import { getTranscriptSegments } from "../features/search/viewModel.js";
import { revertItemToChange, describeFieldValue } from "../features/archive/itemHistory.js";
import {
  createLocalFileValue,
  createVideoLocalFilePatch,
  createVideoItemValue,
  getSubtypeLabel,
  getTypeLabel,
  normalizeLocalFileValue,
  parseVideoTags
} from "../features/videos/viewModel.js";
import { formatDateTime, formatFileSize, formatNumber, normalizeArabicSearchText } from "../utils/formatting.js";
import { useAiAssist } from "../features/ai/useAiAssist.js";
import { AiAssistBar } from "../features/ai/AiAssistBar.jsx";
import { applyProofread, applySummaryToNotes, buildSuggestPayload, correctionsCount, hasSourceText, mergeTagText } from "../features/ai/viewModel.js";
import { canDeleteComment, extractMentionUsernames, getItemComments } from "../features/comments/viewModel.js";
import { FIELD_ACL_ROLES, canViewField, normalizeFieldAcl } from "../features/field-acl/viewModel.js";
import {
  filterDismissedRecommendations,
  getRecommendationFeedback,
  setRecommendationFeedback
} from "../features/recommendations/recommendationFeedback.js";
import { resolveBackendChoice } from "../bootstrap/backendChoice.js";
import { getCloudToken } from "../bootstrap/cloudSession.js";
import { createMediaClient } from "../features/media/mediaClient.js";
import {
  canUseServerMediaTools,
  createMediaMetadataPatch,
  deriveMediaSourceKey,
  createTranscriptBookmarkDraft,
  formatMediaJobStatus,
  mediaProbeToDisplayRows,
  mergeMediaJobs,
  secondsToClock,
  selectSmartThumbnailSecond
} from "../features/media/viewModel.js";
import { TimeBookmarkButton, TimeBookmarkList, TimeBookmarkTimelineMarkers } from "../components/media/TimeBookmarks.jsx";


function fieldKey(field) {
  return field.storageKey || field.name || field.id;
}

function LocalFilePicker({ value, onFileSelect }) {
  const file = normalizeLocalFileValue(value);
  const inputRef = React.useRef(null);
  return jsxs("div", { className: "rounded-xl border border-dashed border-white/10 bg-gray-950/35 p-3", children: [
    jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      jsxs("div", { className: "flex min-w-0 items-center gap-2 text-sm text-gray-300", children: [
        jsx(HardDrive, { className: "h-4 w-4 shrink-0 va-accent-text" }),
        jsx("span", { className: "truncate", dir: "auto", children: file?.name || "لم يتم اختيار ملف" })
      ] }),
      jsx("button", { type: "button", onClick: () => inputRef.current?.click(), className: "inline-flex min-h-9 items-center justify-center va-primary-button rounded-lg px-3 py-1.5 text-xs font-semibold text-white", children: "استعراض" })
    ] }),
    file && jsxs("div", { className: "mt-2 space-y-1 text-xs text-gray-600", children: [
      file.size > 0 && jsx("p", { children: formatFileSize(file.size) }),
      (file.relativePath || file.path) && jsx("p", { dir: "ltr", className: "truncate text-left", children: file.relativePath || file.path })
    ] }),
    jsx("input", {
      ref: inputRef,
      type: "file",
      "aria-label": "اختيار ملف محلي للمادة",
      onChange: (event) => {
        onFileSelect(event.target.files?.[0]);
        event.target.value = "";
      },
      style: { position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }
    })
  ] });
}

/**
 * Renders custom fields, splitting them into tabs when they carry group
 * names (so items with many fields stay scannable). `renderField` returns the
 * per-field node; ungrouped fields fall into a single flat grid (no tabs).
 */
function GroupedFields({ fields, renderField, gap = "gap-4" }) {
  const groups = React.useMemo(() => groupCustomFields(fields), [fields]);
  const [active, setActive] = React.useState(0);
  React.useEffect(() => { if (active >= groups.length) setActive(0); }, [groups.length, active]);
  if (!fields.length) return null;
  const tabbed = groups.length > 1;
  const visible = tabbed ? (groups[active]?.fields || []) : fields;
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
      jsx("div", { className: `grid ${gap} md:grid-cols-2`, children: visible.map(renderField) })
    ]
  });
}

function EditableField({ field, value, onChange }) {
  const key = fieldKey(field);
  const commonClass = "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40";
  if (field.type === "textarea" || field.type === "transcript") return jsx("textarea", { value: value || "", onChange: (event) => onChange(key, event.target.value), rows: 3, className: `${commonClass} p-3` });
  if (field.type === "checkbox") return jsx("input", { type: "checkbox", checked: !!value, onChange: (event) => onChange(key, event.target.checked), className: "h-5 w-5" });
  if (field.type === "select" || field.type === "radio") return jsxs("select", { value: value || "", onChange: (event) => onChange(key, event.target.value), className: commonClass, children: [
    jsx("option", { value: "", children: "اختر..." }),
    ...(field.options || []).map((option) => jsx("option", { value: option, children: option }, option))
  ] });
  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return jsx("select", {
      multiple: true,
      value: selected,
      onChange: (event) => onChange(key, Array.from(event.target.selectedOptions, (option) => option.value)),
      className: `${commonClass} min-h-28 py-2`,
      children: (field.options || []).map((option) => jsx("option", { value: option, children: option }, option))
    });
  }
  if (field.type === "tags") return jsx("input", { value: Array.isArray(value) ? value.join("، ") : value || "", onChange: (event) => onChange(key, parseVideoTags(event.target.value)), className: commonClass });
  if (field.type === "localFile") return jsx(LocalFilePicker, { value, onFileSelect: (file) => onChange(key, createLocalFileValue(file)) });
  if (field.type === "rating") return jsx("div", { className: "flex min-h-11 items-center", children: jsx(StarRating, { value: Number(value) || 0, onChange: (val) => onChange(key, val) }) });
  return jsx("input", { type: field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text", value: value || "", onChange: (event) => onChange(key, event.target.value), className: commonClass });
}

function ReadonlyField({ field, value }) {
  if (field.type === "rating") {
    const num = Number(value) || 0;
    return num > 0 ? jsx(StarRating, { value: num, readonly: true }) : "—";
  }
  if (field.type === "checkbox") return value ? "نعم" : "لا";
  if (field.type === "localFile") {
    const file = normalizeLocalFileValue(value);
    if (!file) return "—";
    return jsxs("div", { className: "space-y-1", children: [
      jsx("p", { className: "font-semibold text-gray-200", dir: "auto", children: file.name || "ملف محلي" }),
      file.size > 0 && jsx("p", { className: "text-xs text-gray-600", children: `${formatFileSize(file.size)} - ${file.extension || "بدون امتداد"}` }),
      file.path && jsx("p", { className: "break-all text-xs text-gray-600", dir: "ltr", children: file.path })
    ] });
  }
  if (Array.isArray(value)) return value.length ? value.join("، ") : "—";
  if (value && typeof value === "object") return JSON.stringify(value);
  return value || "—";
}

const FIELD_ROLE_LABELS = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer"
};

function FieldAclControls({ fieldKey, acl, onChange }) {
  const selected = acl?.[fieldKey] || [];
  const unrestricted = !selected.length;
  const toggle = (role) => {
    const next = selected.includes(role) ? selected.filter((item) => item !== role) : [...selected, role];
    onChange(fieldKey, next);
  };
  return jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-1.5", children: [
    jsx("button", {
      type: "button",
      onClick: () => onChange(fieldKey, []),
      className: `rounded-lg border px-2 py-1 text-[11px] ${unrestricted ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 text-gray-500 hover:bg-white/5"}`,
      children: "كل الأدوار"
    }),
    ...FIELD_ACL_ROLES.map((role) => jsx("button", {
      type: "button",
      onClick: () => toggle(role),
      className: `rounded-lg border px-2 py-1 text-[11px] ${selected.includes(role) ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-white/10 text-gray-500 hover:bg-white/5"}`,
      children: FIELD_ROLE_LABELS[role] || role
    }, role))
  ] });
}

function TranscriptSyncWorkbench({ segments = [], currentTime = 0, onSeek }) {
  const [query, setQuery] = React.useState("");
  const rowRefs = React.useRef(new Map());
  const activeIndex = React.useMemo(() => {
    let active = -1;
    for (const segment of segments) {
      if (segment.seconds === null || segment.seconds === undefined) continue;
      if (Number(segment.seconds) <= Number(currentTime || 0)) active = segment.index;
      else break;
    }
    return active;
  }, [currentTime, segments]);
  const visibleSegments = React.useMemo(() => {
    const normalized = normalizeArabicSearchText(query);
    if (!normalized) return segments;
    return segments.filter((segment) => normalizeArabicSearchText(segment.text).includes(normalized));
  }, [query, segments]);

  React.useEffect(() => {
    const node = rowRefs.current.get(activeIndex);
    if (node) node.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  const renderText = (text) => {
    const value = String(text || "");
    const needle = query.trim();
    if (!needle) return value;
    const index = value.toLocaleLowerCase("ar").indexOf(needle.toLocaleLowerCase("ar"));
    if (index < 0) return value;
    return jsxs(React.Fragment, { children: [
      value.slice(0, index),
      jsx("mark", { className: "rounded bg-amber-400/25 px-0.5 text-amber-50", children: value.slice(index, index + needle.length) }),
      value.slice(index + needle.length)
    ] });
  };

  if (!segments.length) {
    return jsxs("section", { className: "rounded-2xl va-surface-subtle border p-4 text-right", dir: "rtl", children: [
      jsxs("h3", { className: "flex items-center gap-2 text-base font-bold text-white", children: [jsx(FileText, { className: "h-4 w-4 va-accent-text" }), "مشغل التفريغ المتزامن"] }),
      jsx("p", { className: "mt-2 text-sm leading-6 text-gray-500", children: "لا يوجد تفريغ زمني لهذه المادة بعد. أضف تفريغاً في الملاحظات أو metadata.transcript مع timecodes ليتحول إلى قائمة قابلة للقفز." })
    ] });
  }

  return jsxs("section", { className: "rounded-2xl va-surface-subtle border p-4 text-right", dir: "rtl", children: [
    jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
      jsxs("div", { className: "min-w-0", children: [
        jsxs("h3", { className: "flex items-center gap-2 text-base font-bold text-white", children: [jsx(FileText, { className: "h-4 w-4 va-accent-text" }), "مشغل التفريغ المتزامن"] }),
        jsx("p", { className: "mt-1 text-xs text-gray-500", children: `${formatNumber(segments.length)} مقطع زمني. السطر النشط يتبع وقت التشغيل الحالي.` })
      ] }),
      jsx("span", { dir: "ltr", className: "rounded-full border border-white/10 bg-gray-950/35 px-3 py-1 font-mono text-xs text-gray-300", children: segments.find((segment) => segment.index === activeIndex)?.timecode || "0:00" })
    ] }),
    jsxs("label", { className: "mt-3 block", children: [
      jsx("span", { className: "sr-only", children: "بحث داخل التفريغ" }),
      jsx("input", {
        value: query,
        onChange: (event) => setQuery(event.target.value),
        placeholder: "بحث داخل التفريغ...",
        className: "min-h-10 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40"
      })
    ] }),
    jsx("div", { className: "mt-3 max-h-[360px] space-y-2 overflow-y-auto pe-1", children: visibleSegments.map((segment) => {
      const active = segment.index === activeIndex;
      return jsxs("button", {
        ref: (node) => {
          if (node) rowRefs.current.set(segment.index, node);
          else rowRefs.current.delete(segment.index);
        },
        type: "button",
        onClick: () => segment.seconds !== null && segment.seconds !== undefined ? onSeek?.(segment.seconds) : undefined,
        className: `grid w-full gap-2 rounded-xl border p-3 text-right transition-colors sm:grid-cols-[4.5rem_minmax(0,1fr)] ${active ? "va-accent-border va-accent-bg-soft text-white" : "border-white/10 bg-gray-950/25 text-gray-300 hover:border-emerald-500/20 hover:bg-white/5"}`,
        children: [
          jsx("span", { dir: "ltr", className: `font-mono text-xs ${active ? "va-accent-text-on-soft" : "text-gray-500"}`, children: segment.timecode || "—" }),
          jsx("span", { className: "text-sm leading-7", children: renderText(segment.text) })
        ]
      }, `${segment.index}-${segment.seconds ?? "none"}`);
    }) }),
    visibleSegments.length === 0 && jsx("p", { className: "mt-3 rounded-xl border border-white/10 bg-gray-950/25 p-3 text-sm text-gray-500", children: "لا توجد أسطر مطابقة داخل التفريغ." })
  ] });
}

const PREVIEW_STATE_COPY = {
  [MEDIA_PREVIEW_STATUS.LOADING]: {
    tone: "va-accent-text-on-soft",
    Icon: Loader2,
    title: "جاري تجهيز المعاينة",
    description: "نحاول قراءة بيانات الفيديو. إذا لم يرد المتصفح خلال ثوانٍ سنعرض خيارات بديلة."
  },
  [MEDIA_PREVIEW_STATUS.MISSING_PATH]: {
    tone: "text-amber-200",
    Icon: AlertTriangle,
    title: "لا يوجد مسار للملف",
    description: "العنصر محفوظ كبيانات أرشيفية، لكن لا يوجد مسار فيديو يمكن تشغيله."
  },
  [MEDIA_PREVIEW_STATUS.UNSUPPORTED_FORMAT]: {
    tone: "text-sky-200",
    Icon: Info,
    title: "صيغة غير مدعومة للمعاينة",
    description: "المتصفح لا يستطيع تشغيل هذه الصيغة مباشرة. يمكنك حفظ البيانات أو تحديث المسار إلى ملف MP4/WebM/Ogg."
  },
  [MEDIA_PREVIEW_STATUS.BLOCKED_LOCAL_PATH]: {
    tone: "text-amber-200",
    Icon: ShieldAlert,
    title: "المسار المحلي محجوب من المتصفح",
    description: "عند تشغيل التطبيق عبر localhost يمنع المتصفح فتح بعض مسارات الجهاز مباشرة. اربط الملف من زر الاستعراض أو انسخ المسار للتحقق منه."
  },
  [MEDIA_PREVIEW_STATUS.TIMED_OUT]: {
    tone: "text-red-200",
    Icon: AlertTriangle,
    title: "تعذر تحميل المعاينة",
    description: "لم تصل بيانات الفيديو في الوقت المناسب. قد يكون الملف غير موجود، أو أن المتصفح لا يستطيع الوصول إلى هذا المسار."
  }
};

function PreviewAction({ onClick, children, icon, primary = false, disabled = false }) {
  return jsxs("button", {
    type: "button",
    onClick,
    disabled,
    className: `${primary ? "va-primary-button border-transparent text-white" : "border-white/10 bg-white/[0.035] text-gray-300 hover:bg-white/[0.06] hover:text-white"} inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45`,
    children: [icon, children]
  });
}

function MediaPreviewFallback({ state, descriptor, onCopyPath, onEditPath, onMetadataOnly }) {
  const content = PREVIEW_STATE_COPY[state] || PREVIEW_STATE_COPY[MEDIA_PREVIEW_STATUS.TIMED_OUT];
  const Icon = content.Icon;
  const hasPath = Boolean(descriptor?.path);

  return jsxs("div", {
    className: "flex aspect-video w-full flex-col justify-between bg-gray-950 p-4 text-right",
    dir: "rtl",
    children: [
      jsxs("div", {
        className: "flex min-h-0 flex-1 flex-col items-center justify-center text-center",
        children: [
          jsx("span", {
            className: `inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] ${content.tone}`,
            children: jsx(Icon, { className: `h-6 w-6 ${state === MEDIA_PREVIEW_STATUS.LOADING ? "animate-spin" : ""}` })
          }),
          jsx("h2", { className: "mt-3 text-base font-bold text-white", children: content.title }),
          jsx("p", { className: "mt-1 max-w-sm text-xs leading-6 text-gray-500", children: content.description }),
          hasPath && jsx("p", {
            className: "mt-3 max-w-full break-all rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left font-mono text-[11px] text-gray-400",
            dir: "ltr",
            children: descriptor.path
          })
        ]
      }),
      state !== MEDIA_PREVIEW_STATUS.LOADING && jsxs("div", {
        className: "mt-4 grid gap-2 sm:grid-cols-3",
        children: [
          jsx(PreviewAction, { onClick: onCopyPath, disabled: !hasPath, icon: jsx(Copy, { className: "h-3.5 w-3.5" }), children: "نسخ المسار" }),
          jsx(PreviewAction, { onClick: onEditPath, primary: true, icon: jsx(PenLine, { className: "h-3.5 w-3.5" }), children: "تعديل المسار" }),
          jsx(PreviewAction, { onClick: onMetadataOnly, icon: jsx(FileText, { className: "h-3.5 w-3.5" }), children: "البيانات فقط" })
        ]
      })
    ]
  });
}

function MediaToolButton({ icon, label, busy, disabled, onClick }) {
  return jsxs("button", {
    type: "button",
    onClick,
    disabled: disabled || busy,
    className: "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45",
    children: [busy ? jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin" }) : icon, label]
  });
}

function MediaJobsMiniList({ jobs, onRetry }) {
  if (!jobs.length) return jsx("p", { className: "text-xs text-gray-500", children: "لا توجد مهام وسائط حديثة." });
  return jsx("ul", { className: "space-y-2", children: jobs.slice(0, 4).map((job) => {
    const status = formatMediaJobStatus(job);
    return jsxs("li", { className: "rounded-xl va-surface-subtle border p-3", children: [
      jsxs("div", { className: "flex items-center justify-between gap-2", children: [
        jsxs("div", { className: "min-w-0", children: [
          jsx("p", { className: "truncate text-xs font-semibold text-gray-200", children: job.type === "montage" ? "مونتاج" : "تحويل نسخة ويب" }),
          jsx("p", { className: `mt-0.5 text-[11px] ${status.tone}`, children: status.label })
        ] }),
        jsx("span", { dir: "ltr", className: "font-mono text-xs text-gray-400", children: `${Math.round(status.progress)}%` })
      ] }),
      jsx("div", { className: "mt-2 h-1.5 overflow-hidden rounded-full bg-white/10", children: jsx("div", { className: "h-full rounded-full bg-[var(--va-action)]", style: { width: `${status.progress}%` } }) }),
      job.outputKey && jsx("p", { dir: "ltr", className: "mt-2 truncate text-left font-mono text-[11px] text-gray-500", children: job.outputKey }),
      job.status === "error" && jsxs("div", { className: "mt-2 flex items-center justify-between gap-2", children: [
        jsx("p", { className: "min-w-0 flex-1 truncate text-xs text-red-200", children: job.error || "فشلت المهمة" }),
        jsx("button", { type: "button", onClick: () => onRetry?.(job.id), className: "shrink-0 rounded-lg border border-red-500/30 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/10", children: "إعادة" })
      ] })
    ] }, job.id);
  }) });
}

export function DetailPage() {
  const {
    videoItems = [],
    contentTypes = [],
    changeHistory = [],
    bookmarks = [],
    auditLogs = [],
    users = [],
    currentUser = null,
    selectedItemId,
    setSelectedItemId,
    setCurrentPage,
    navItemIds = [],
    updateVideoItem,
    deleteVideoItem,
    restoreVideoItem,
    toggleFavorite,
    markItemViewed,
    addBookmark,
    removeBookmark,
    addItemComment,
    deleteItemComment,
    showToast,
    showNotification,
    itemRelations = [],
    loadRelationsFromStorage,
    addRelation,
    removeRelation,
    itemNotes = [],
    loadItemNotesFromStorage,
    addItemNote,
    removeItemNote
  } = useAppStore();

  const item = videoItems.find((video) => video.id === selectedItemId) || null;
  // §1408 — next/previous through the filtered list captured at open time.
  // Fall back to the full item order so the navigator still works when the
  // detail page is reached without going through the archive (e.g. deep link).
  const navOrder = React.useMemo(
    () => (navItemIds.length ? navItemIds : videoItems.map((video) => video.id)),
    [navItemIds, videoItems]
  );
  const navPosition = getItemPosition(selectedItemId, navOrder);
  const goToAdjacent = React.useCallback((direction) => {
    const targetId = resolveAdjacentItem(selectedItemId, navOrder, direction);
    if (targetId) setSelectedItemId?.(targetId);
  }, [selectedItemId, navOrder, setSelectedItemId]);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(null);
  const [commentDraft, setCommentDraft] = React.useState("");
  const [commentBusy, setCommentBusy] = React.useState(false);
  const [mediaBusy, setMediaBusy] = React.useState("");
  const [mediaJobs, setMediaJobs] = React.useState([]);
  const [activeDetailTab, setActiveDetailTab] = React.useState("data");
  const [relationDialogOpen, setRelationDialogOpen] = React.useState(false);
  const [playbackTime, setPlaybackTime] = React.useState(0);
  const [subtitlesOn, setSubtitlesOn] = React.useState(true);
  const [importedCues, setImportedCues] = React.useState([]);
  const [captionSize, setCaptionSize] = React.useState("md");
  const [captionColor, setCaptionColor] = React.useState("#ffffff");
  const [recommendationFeedback, setRecommendationFeedbackState] = React.useState(() => getRecommendationFeedback());
  const transcriptSegments = React.useMemo(() => item ? getTranscriptSegments(item) : [], [item]);
  // Derive subtitle cues from timed transcript segments: each cue runs until the
  // next timed segment starts (4s fallback for the last one).
  const transcriptCues = React.useMemo(() => {
    const timed = transcriptSegments.filter((segment) => Number.isFinite(segment.seconds));
    return segmentsToCues(timed.map((segment, index) => ({
      start: segment.seconds,
      end: Number.isFinite(timed[index + 1]?.seconds) ? timed[index + 1].seconds : segment.seconds + 4,
      text: segment.text
    })));
  }, [transcriptSegments]);
  // An imported SRT/VTT file overrides the transcript-derived cues when present.
  const subtitleCues = importedCues.length ? importedCues : transcriptCues;
  const autosaveEngineRef = React.useRef(null);
  const draftRef = React.useRef(null);
  const [autosaveStatus, setAutosaveStatus] = React.useState("idle");
  const [recoveryDraft, setRecoveryDraft] = React.useState(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = React.useState(false);

  React.useEffect(() => {
    loadRelationsFromStorage?.();
  }, [loadRelationsFromStorage]);

  React.useEffect(() => {
    loadItemNotesFromStorage?.();
  }, [loadItemNotesFromStorage]);

  React.useEffect(() => {
    setDraft(item ? {
      ...item,
      tagsText: (item.tags || []).join("، "),
      metadata: { ...(item.metadata || {}) },
      fieldAcl: normalizeFieldAcl(item.fieldAcl || {})
    } : null);
    setEditing(false);
    setPlaybackTime(0);
    setImportedCues([]);
    if (item?.id && !item.isDeleted) {
      markItemViewed?.(item.id);
    }
  }, [item?.id, item?.isDeleted, markItemViewed]);

  // Keep draftRef in sync so the autosave engine always captures latest state
  React.useEffect(() => { draftRef.current = draft; }, [draft]);

  // Create autosave engine per item; check for recoverable draft on mount
  React.useEffect(() => {
    if (!item?.id) { autosaveEngineRef.current = null; return; }
    const key = `edit_item_${item.id}`;
    const storage = {
      get: (k) => { try { return Promise.resolve(JSON.parse(localStorage.getItem(k) || "null")); } catch { return Promise.resolve(null); } },
      put: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota/private */ } return Promise.resolve(); },
      delete: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } return Promise.resolve(); }
    };
    const engine = createAutosaveEngine({ storage, key });
    autosaveEngineRef.current = engine;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      if (stored?.data && !isDraftExpired(stored)) {
        setRecoveryDraft(stored);
        setShowRecoveryDialog(true);
      }
    } catch { /* ignore malformed */ }
    return () => { engine.stop(); autosaveEngineRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  // Start/stop engine when editing mode changes
  React.useEffect(() => {
    const engine = autosaveEngineRef.current;
    if (!engine) return;
    if (editing) {
      engine.start(() => draftRef.current);
      setAutosaveStatus(engine.getStatus());
      const pollId = setInterval(() => setAutosaveStatus(engine.getStatus()), 2000);
      return () => clearInterval(pollId);
    }
    engine.stop();
    setAutosaveStatus("idle");
  }, [editing]);

  const ai = useAiAssist({ showToast });
  const aiSuggestTags = async () => {
    const result = await ai.suggestTags(buildSuggestPayload({ title: draft?.title, notes: draft?.notes, contentTypes }));
    if (!result) return;
    setEditing(true);
    updateDraft({ tagsText: mergeTagText(draft?.tagsText, result.tags) });
    showToast?.(result.tags?.length ? `أُضيفت ${result.tags.length} وسوم مقترحة` : "لا وسوم جديدة مقترحة", "success");
  };
  const aiSummarize = async () => {
    if (!hasSourceText({ title: draft?.title, notes: draft?.notes })) { showToast?.("أضف ملاحظات أو عنوانًا أولاً للتلخيص.", "warning"); return; }
    const result = await ai.summarize(draft?.notes?.trim() || draft?.title || "");
    if (!result) return;
    setEditing(true);
    updateDraft({ notes: applySummaryToNotes(draft?.notes, result.summary), tagsText: mergeTagText(draft?.tagsText, result.tags) });
    showToast?.("أُضيف ملخّص إلى الملاحظات", "success");
  };
  const aiProofread = async () => {
    if (!String(draft?.notes || "").trim()) { showToast?.("لا توجد ملاحظات لتدقيقها.", "warning"); return; }
    const result = await ai.proofread(draft.notes);
    if (!result) return;
    setEditing(true);
    updateDraft({ notes: applyProofread(draft.notes, result) });
    const n = correctionsCount(result);
    showToast?.(n ? `تم التدقيق: ${n} تصحيح` : "لا أخطاء واضحة", "success");
  };

  const fields = React.useMemo(() => item ? getFieldsForSelection(contentTypes, draft?.type || item.type, draft?.subtype || item.subtype) : [], [contentTypes, draft?.subtype, draft?.type, item]);
  const canManageFieldAcl = currentUser?.role === "admin";
  const canEditTags = canViewField("tags", draft?.fieldAcl || item?.fieldAcl, currentUser);
  const canEditNotes = canViewField("notes", draft?.fieldAcl || item?.fieldAcl, currentUser);
  const canViewTags = canViewField("tags", item?.fieldAcl, currentUser);
  const canViewNotes = canViewField("notes", item?.fieldAcl, currentUser);
  const canViewPrimaryLocalFile = canViewField("localFile", item?.fieldAcl, currentUser);
  const editFields = React.useMemo(() => getVisibleFields(fields, draft?.metadata || {}).filter((field) => canViewField(fieldKey(field), draft?.fieldAcl || item?.fieldAcl, currentUser)), [currentUser, draft?.fieldAcl, draft?.metadata, fields, item?.fieldAcl]);
  const allReadFields = React.useMemo(() => item ? getVisibleFields(fields, item.metadata || {}) : [], [fields, item]);
  const readFields = React.useMemo(() => allReadFields.filter((field) => canViewField(fieldKey(field), item?.fieldAcl, currentUser)), [allReadFields, currentUser, item?.fieldAcl]);
  const hiddenCustomReadFields = Math.max(0, allReadFields.length - readFields.length);
  const hiddenTopLevelReadFields = [
    item?.tags?.length && !canViewTags,
    item?.notes && !canViewNotes,
    item?.metadata?.localFile && !canViewPrimaryLocalFile
  ].filter(Boolean).length;
  const hiddenReadFields = hiddenCustomReadFields + hiddenTopLevelReadFields;
  const selectedType = contentTypes.find((type) => type.id === (draft?.type || item?.type));
  const completeness = React.useMemo(() => item ? computeCompleteness(item, selectedType) : null, [item, selectedType]);
  const videoRef = React.useRef(null);
  const pathInputRef = React.useRef(null);
  const metadataSectionRef = React.useRef(null);
  const commentsSectionRef = React.useRef(null);
  const runtimeProtocol = typeof window !== "undefined" ? window.location.protocol : "";
  const mediaPath = item?.path || item?.filePath || item?.url || "";
  const previewDescriptor = React.useMemo(
    () => getMediaPreviewDescriptor(mediaPath, { runtimeProtocol }),
    [mediaPath, runtimeProtocol]
  );
  const [previewRuntimeState, setPreviewRuntimeState] = React.useState(MEDIA_PREVIEW_STATUS.LOADING);
  const [playbackDuration, setPlaybackDuration] = React.useState(0);
  const itemBookmarks = React.useMemo(
    () => (bookmarks || []).filter((bookmark) => bookmark.itemId === item?.id).sort((a, b) => a.timestamp - b.timestamp),
    [bookmarks, item?.id]
  );
  const itemComments = React.useMemo(() => getItemComments(auditLogs, item?.id), [auditLogs, item?.id]);
  const relatedItems = React.useMemo(() => item ? getRelatedItems(item, videoItems, { limit: 6 }) : [], [item, videoItems]);
  const explicitItemRelations = React.useMemo(
    () => getItemRelations(item?.id, itemRelations),
    [item?.id, itemRelations]
  );
  const explicitRelationIds = React.useMemo(() => [
    ...(explicitItemRelations.outgoing || []).map((relation) => relation.targetId),
    ...(explicitItemRelations.incoming || []).map((relation) => relation.sourceId)
  ].filter(Boolean), [explicitItemRelations]);
  const improvementSuggestions = React.useMemo(
    () => item ? getItemImprovementSuggestions(item, videoItems, { relatedItems, explicitRelationIds, limit: 4 }) : [],
    [explicitRelationIds, item, relatedItems, videoItems]
  );
  const visibleImprovementSuggestions = React.useMemo(
    () => filterDismissedRecommendations(improvementSuggestions, recommendationFeedback),
    [improvementSuggestions, recommendationFeedback]
  );
  const itemHistory = React.useMemo(
    () => (changeHistory || []).filter((record) => record.itemId === item?.id && Array.isArray(record.changes) && record.changes.length > 0),
    [changeHistory, item?.id]
  );
  const subtypes = selectedType?.subtypes || [];
  const history = React.useMemo(() => item ? changeHistory.filter((record) => record.itemId === item.id).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 10) : [], [changeHistory, item]);
  const previewSource = previewDescriptor.status === MEDIA_PREVIEW_STATUS.PLAYABLE ? previewDescriptor.source : null;
  const backendChoice = resolveBackendChoice();
  const cloudToken = getCloudToken();
  const mediaSourceKey = deriveMediaSourceKey(item || {});
  const mediaToolsEnabled = canUseServerMediaTools({ backend: backendChoice.backend, token: cloudToken, role: currentUser?.role });
  const mediaUnavailable = !mediaSourceKey
    ? "هذه المادة ليست مرفوعة إلى FileStore بعد. ارفع الملف أولاً ثم استخدم أدوات ffmpeg."
    : !mediaToolsEnabled
      ? "أدوات ffmpeg تحتاج خادمًا سحابيًا وتسجيل دخول بدور editor/admin."
      : "";
  const mediaInfo = item?.metadata?.media || {};
  const bookmarkDuration = playbackDuration || Number(mediaInfo.durationSec || item?.duration || 0);
  const mediaRows = React.useMemo(() => mediaProbeToDisplayRows(mediaInfo), [mediaInfo]);

  const makeMediaClient = React.useCallback(() => createMediaClient({
    baseUrl: backendChoice.url,
    getToken: getCloudToken
  }), [backendChoice.url]);

  const refreshMediaJobs = React.useCallback(async () => {
    if (!mediaToolsEnabled) return;
    try {
      const jobs = await makeMediaClient().listJobs();
      setMediaJobs(mergeMediaJobs(jobs));
    } catch {
      setMediaJobs([]);
    }
  }, [makeMediaClient, mediaToolsEnabled]);

  React.useEffect(() => { refreshMediaJobs(); }, [refreshMediaJobs]);

  React.useEffect(() => {
    if (previewDescriptor.status !== MEDIA_PREVIEW_STATUS.PLAYABLE) {
      setPreviewRuntimeState(previewDescriptor.status);
      return undefined;
    }

    setPreviewRuntimeState(MEDIA_PREVIEW_STATUS.LOADING);
    const timeoutApi = typeof window !== "undefined" ? window : globalThis;
    const timeoutId = timeoutApi.setTimeout(() => {
      setPreviewRuntimeState((current) => (
        current === MEDIA_PREVIEW_STATUS.PLAYABLE ? current : MEDIA_PREVIEW_STATUS.TIMED_OUT
      ));
    }, 8000);

    return () => timeoutApi.clearTimeout(timeoutId);
  }, [previewDescriptor.source, previewDescriptor.status]);

  React.useEffect(() => {
    if (!item?.id) return;
    try {
      const raw = sessionStorage.getItem("videoArchive:pendingTranscriptSeek");
      if (!raw) return;
      const pending = JSON.parse(raw);
      if (pending?.itemId !== item.id || !Number.isFinite(Number(pending.seconds))) return;
      const nextTime = Math.max(0, Number(pending.seconds) || 0);
      sessionStorage.removeItem("videoArchive:pendingTranscriptSeek");
      setActiveDetailTab("media");
      setPlaybackTime(nextTime);
      window.requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = nextTime;
        video.play?.().catch(() => {});
      });
    } catch (error) {
      /* non-critical navigation hint */
    }
  }, [item?.id, previewSource]);

  if (!item) {
    return jsxs(MotionPage, { className: "space-y-6 p-4 text-center sm:p-6", children: [
      jsx(UXEmptyState, {
        icon: jsx(Video, { className: "h-8 w-8" }),
        title: "لم يتم اختيار فيديو",
        description: "افتح عنصرًا من الأرشيف لعرض تفاصيله أو استخدم البحث للوصول إلى مادة محددة.",
        actions: jsx("button", { type: "button", onClick: () => setCurrentPage?.("archive"), className: "va-primary-button rounded-xl px-4 py-2 text-sm font-semibold text-white", children: "فتح الأرشيف" })
      })
    ] });
  }

  const itemStats = [
    { id: "type", label: "التصنيف", value: getTypeLabel(contentTypes, item.type) || "غير محدد", icon: FileText },
    { id: "tags", label: "الوسوم", value: canViewTags ? formatNumber(item.tags?.length || 0) : "محجوبة", icon: Tags },
    { id: "version", label: "الإصدار", value: formatNumber(item.version || 1), icon: Gauge },
    { id: "updated", label: "آخر تحديث", value: item.updatedAt ? formatDateTime(item.updatedAt) : "—", icon: Clock3 }
  ];
  const detailTabs = [
    { id: "data", label: "البيانات", icon: FileText },
    { id: "comments", label: "التعليقات", icon: MessageSquare },
    { id: "notes", label: "ملاحظاتي", icon: StickyNote },
    { id: "history", label: "التاريخ", icon: Clock3 },
    { id: "versions", label: "السجل التاريخي", icon: History },
    { id: "media", label: "الوسائط", icon: HardDrive },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "relations", label: "العلاقات", icon: Gauge }
  ];

  const previewState = previewDescriptor.status === MEDIA_PREVIEW_STATUS.PLAYABLE
    ? previewRuntimeState
    : previewDescriptor.status;

  const updateDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const updateMetadata = (key, value) => setDraft((current) => ({ ...current, metadata: { ...(current.metadata || {}), [key]: value } }));
  const updateFieldAcl = (key, roles) => setDraft((current) => {
    const acl = normalizeFieldAcl(current?.fieldAcl || {});
    if (!roles?.length) delete acl[key];
    else acl[key] = roles;
    return { ...current, fieldAcl: acl };
  });
  const handleImprovementSuggestion = (suggestion) => {
    if (suggestion.targetItemId) {
      setSelectedItemId?.(suggestion.targetItemId);
      return;
    }
    if (suggestion.action === "archive") {
      setCurrentPage?.("archive");
      return;
    }
    setActiveDetailTab("data");
    setEditing(true);
    if (suggestion.id === "add-peer-tags" && suggestion.suggestedTags?.length) {
      setDraft((current) => {
        const base = current || {
          ...item,
          tagsText: (item.tags || []).join("، "),
          metadata: { ...(item.metadata || {}) },
          fieldAcl: normalizeFieldAcl(item.fieldAcl || {})
        };
        return { ...base, tagsText: mergeTagText(base.tagsText, suggestion.suggestedTags) };
      });
    }
  };
  const handleRecommendationFeedback = (suggestion, value) => {
    setRecommendationFeedbackState(setRecommendationFeedback(suggestion.key || suggestion.id, value));
    if (value === "dismissed") showToast?.("تم إخفاء الاقتراح", "success");
  };
  const applyPrimaryLocalFile = (file) => {
    const patch = createVideoLocalFilePatch(file, { currentTitle: draft?.title || item.title });
    if (!patch) return;
    setDraft((current) => ({
      ...current,
      ...(patch.title ? { title: patch.title } : {}),
      path: patch.path,
      metadata: { ...(current.metadata || {}), ...patch.metadata }
    }));
  };

  const submitComment = async () => {
    const text = commentDraft.trim();
    if (!text) return;
    setCommentBusy(true);
    try {
      await addItemComment?.(item.id, text);
      setCommentDraft("");
      const mentionUsernames = extractMentionUsernames(text);
      const mentionedUsers = users.filter((user) => mentionUsernames.some((username) => username.toLowerCase() === String(user.username || "").toLowerCase()));
      showNotification?.("تمت إضافة تعليق على هذه المادة.", {
        type: "success",
        category: mentionUsernames.length ? "mention" : "comment",
        title: mentionUsernames.length ? "إشارة في تعليق" : "تعليق جديد",
        targetLabel: mentionUsernames.length
          ? `${item.title || "مادة"} · ${mentionedUsers.map((user) => user.displayName || user.username).join("، ") || mentionUsernames.join("، ")}`
          : item.title || "مادة",
        action: { label: "فتح المادة", run: () => setSelectedItemId?.(item.id) }
      });
    } catch (error) {
      reportError(showNotification, error, { context: "إضافة تعليق" });
    } finally {
      setCommentBusy(false);
    }
  };
  const removeComment = async (comment) => {
    const confirmed = await appConfirm("حذف هذا التعليق؟", { title: "حذف تعليق", kind: "danger", confirmLabel: "حذف" });
    if (!confirmed) return;
    try {
      await deleteItemComment?.(comment.id);
      showToast?.("تم حذف التعليق", "info");
    } catch (error) {
      reportError(showNotification, error, { context: "حذف تعليق" });
    }
  };
  const handleAddRelation = async (relation) => {
    try {
      const created = await addRelation?.(relation);
      if (created) showToast?.("تمت إضافة العلاقة", "success");
    } catch (error) {
      reportError(showNotification, error, { context: "إضافة علاقة" });
    }
  };
  const handleRemoveRelation = async (relationId) => {
    try {
      const removed = await removeRelation?.(relationId);
      if (removed) showToast?.("تم حذف العلاقة", "info");
    } catch (error) {
      reportError(showNotification, error, { context: "حذف علاقة" });
    }
  };
  const seekToBookmark = (timestamp) => {
    const video = videoRef.current;
    const nextTime = Math.max(0, Number(timestamp) || 0);
    setPlaybackTime(nextTime);
    if (!video) return;
    video.currentTime = nextTime;
    video.play?.().catch(() => {});
  };

  const addTimeBookmark = async (bookmark) => {
    try {
      await addBookmark?.({ itemId: item.id, timestamp: bookmark.time, label: bookmark.title, description: bookmark.note });
      showToast?.("تمت إضافة العلامة الزمنية", "success");
    } catch (error) {
      reportError(showNotification, error, { context: "إضافة علامة زمنية" });
    }
  };

  // G7 — render free text with `MM:SS`/`HH:MM:SS` turned into clickable seek
  // links (only when a previewable video exists; otherwise plain text). The
  // timecodes keep dir="ltr" + tabular font so they read correctly in RTL.
  const renderTextWithTimestamps = (text) => {
    if (!previewSource || !hasTimestamps(text)) return text;
    return parseTimestampSegments(text).map((seg, index) => {
      if (seg.type === "text") return seg.value;
      return jsx("button", {
        type: "button",
        onClick: () => seekToBookmark(seg.seconds),
        dir: "ltr",
        title: "اقفز إلى هذه اللحظة",
        className: "mx-0.5 inline-flex items-center rounded-md border px-1.5 py-0.5 align-baseline font-mono text-xs transition-colors",
        style: {
          borderColor: "color-mix(in srgb, var(--va-action) 35%, transparent)",
          background: "color-mix(in srgb, var(--va-action) 12%, transparent)",
          color: "var(--va-action)"
        },
        children: seg.value
      }, `ts-${index}`);
    });
  };

  const restoreVersion = async (record) => {
    const confirmed = await appConfirm(`استرجاع القيم كما كانت قبل تعديل ${formatDateTime(record.timestamp)}؟ سيُنشأ تعديل جديد بهذه القيم.`, {
      title: "استرجاع نسخة سابقة",
      kind: "warning",
      confirmLabel: "استرجاع"
    });
    if (!confirmed) return;
    const reverted = createVideoItemValue({ ...revertItemToChange(item, record.changes), id: item.id, createdAt: item.createdAt, version: (item.version || 1) + 1 });
    try {
      await updateVideoItem?.(reverted);
      showToast?.("تم استرجاع النسخة السابقة", "success");
    } catch (error) {
      showToast?.("تعذّر استرجاع النسخة", "error");
    }
  };

  const save = async () => {
    const missingRequired = getMissingRequiredFields(fields, draft.metadata || {});
    if (missingRequired.length) {
      showToast?.(`حقول مطلوبة فارغة: ${missingRequired.map((field) => field.label).join("، ")}`, "error");
      return;
    }
    const updated = createVideoItemValue({
      ...item,
      ...draft,
      tags: parseVideoTags(draft.tagsText),
      metadata: draft.metadata || {},
      fieldAcl: normalizeFieldAcl(draft.fieldAcl || {}),
      createdAt: item.createdAt,
      version: (item.version || 1) + 1
    });
    try {
      await updateVideoItem?.(updated);
      showToast?.("تم حفظ التعديلات", "success");
      setEditing(false);
      try { localStorage.removeItem(`edit_item_${item.id}`); } catch { /* ignore */ }
      autosaveEngineRef.current?.stop();
      setAutosaveStatus("idle");
    } catch (error) {
      reportError(showNotification, error, {
        context: "حفظ التعديلات",
        recovery: { run: save }
      });
    }
  };

  const deleteOrRestore = async () => {
    if (item.isDeleted) {
      await restoreVideoItem?.(item.id);
      return;
    }
    const confirmed = await appConfirm(`هل تريد نقل "${item.title}" إلى سلة المحذوفات؟`, {
      title: "حذف فيديو",
      kind: "warning",
      confirmLabel: "نقل للسلة"
    });
    if (!confirmed) return;
    await deleteVideoItem?.(item.id);
  };

  const copyPath = async () => {
    if (!mediaPath) return;
    try {
      await navigator.clipboard?.writeText(mediaPath);
      showToast?.("تم نسخ المسار", "success");
    } catch (error) {
      reportError(showNotification, error, {
        context: "نسخ المسار",
        hint: "قد لا يدعم المتصفح الكتابة على الحافظة. جرّب نسخ المسار يدويًا.",
        recovery: { run: copyPath }
      });
    }
  };

  const startPathEdit = () => {
    setEditing(true);
    const focusPathInput = () => {
      pathInputRef.current?.focus();
      pathInputRef.current?.select?.();
    };
    if (typeof window === "undefined") {
      focusPathInput();
      return;
    }
    window.requestAnimationFrame(focusPathInput);
  };

  const showMetadataOnly = () => {
    metadataSectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const saveMediaPatch = async (patch, message) => {
    const metadata = {
      ...(item.metadata || {}),
      ...(patch.metadata || {}),
      media: {
        ...(item.metadata?.media || {}),
        ...(patch.metadata?.media || {})
      }
    };
    const updated = createVideoItemValue({
      ...item,
      ...patch,
      metadata,
      createdAt: item.createdAt,
      version: (item.version || 1) + 1
    });
    await updateVideoItem?.(updated);
    showToast?.(message, "success");
  };

  const runMediaAction = async (id, action) => {
    if (mediaUnavailable) {
      showToast?.(mediaUnavailable, "warning");
      return;
    }
    setMediaBusy(id);
    try {
      await action(makeMediaClient());
      await refreshMediaJobs();
    } catch (error) {
      reportError(showNotification, error, { context: "أدوات ffmpeg" });
    } finally {
      setMediaBusy("");
    }
  };

  const runProbe = () => runMediaAction("probe", async (client) => {
    const probe = await client.probe(mediaSourceKey);
    await saveMediaPatch(createMediaMetadataPatch({ probe }), "تم تحديث بيانات الوسائط");
  });

  const runThumbnail = () => runMediaAction("thumbnail", async (client) => {
    const atSec = selectSmartThumbnailSecond(mediaInfo);
    const result = await client.thumbnail(mediaSourceKey, { atSec, width: 640 });
    await saveMediaPatch(createMediaMetadataPatch({ probe: mediaInfo, thumbnailKey: result.outputKey }), "تم إنشاء الصورة المصغّرة");
  });

  const runAudio = () => runMediaAction("audio", async (client) => {
    const result = await client.audio(mediaSourceKey, { format: "mp3", bitrate: "192k" });
    await saveMediaPatch(createMediaMetadataPatch({ probe: mediaInfo, audioKey: result.outputKey }), "تم استخراج الصوت");
  });

  const runPreviewGif = () => runMediaAction("preview", async (client) => {
    const result = await client.preview(mediaSourceKey, { startSec: 0, durationSec: 4, width: 360, fps: 12 });
    await saveMediaPatch(createMediaMetadataPatch({ probe: mediaInfo, previewKey: result.outputKey }), "تم إنشاء معاينة GIF");
  });

  const runTranscode = () => runMediaAction("transcode", async (client) => {
    const result = await client.transcode(mediaSourceKey, { height: 720, durationSec: mediaInfo.durationSec || item.duration || 0 });
    showNotification?.("بدأت مهمة تحويل الوسائط.", {
      type: "info",
      category: "export",
      title: "مهمة وسائط",
      targetLabel: item.title || "مادة"
    });
    if (result?.job) setMediaJobs((current) => mergeMediaJobs([result.job, ...current]));
  });

  const retryMediaJob = async (jobId) => {
    await runMediaAction(`retry-${jobId}`, async (client) => {
      await client.retryJob(jobId);
      showToast?.("أُعيدت المهمة إلى الطابور", "info");
    });
  };

  const handleWorkflowChanged = async (result) => {
    if (!item?.id || !result?.status) return;
    const updated = createVideoItemValue({
      ...item,
      workflowStatus: result.status,
      workflowDueDate: result.dueDate ?? item.workflowDueDate ?? null,
      workflowUpdatedAt: result.entry?.at || new Date().toISOString(),
      createdAt: item.createdAt,
      version: (item.version || 1) + 1
    });
    try {
      await updateVideoItem?.(updated);
      showToast?.("تم تغيير حالة السجل", "success");
    } catch (error) {
      reportError(showNotification, error, { context: "تغيير حالة السجل" });
    }
  };

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 sm:p-6",
    children: [
      jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        jsxs("nav", { className: "flex items-center gap-2 text-sm text-gray-500", "aria-label": "مسار التنقل", children: [
          jsxs("button", { type: "button", onClick: () => setCurrentPage?.("archive"), className: "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300", children: [jsx(ArrowRight, { className: "h-3.5 w-3.5" }), "الأرشيف"] }),
          jsx("span", { className: "text-gray-700", children: "/" }),
          jsx("span", { className: "max-w-[200px] truncate text-gray-400", children: item.title || "التفاصيل" })
        ] }),
        jsx(DetailNavigationPanel, {
          position: navPosition,
          onPrevious: () => goToAdjacent("previous"),
          onNext: () => goToAdjacent("next")
        })
      ] }),
      jsxs("div", { className: "grid gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] xl:items-start", children: [
        jsxs("div", { className: "space-y-6 xl:sticky xl:top-4 xl:self-start", children: [
      jsxs("section", { className: "va-page-hero overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-l from-gray-900 via-gray-900/95 to-gray-950 text-right shadow-2xl shadow-black/10", children: [
        previewSource && previewState !== MEDIA_PREVIEW_STATUS.TIMED_OUT ? jsx(VideoPlayer, {
          videoRef,
          src: previewSource,
          cues: subtitleCues,
          subtitlesOn,
          onToggleSubtitles: () => setSubtitlesOn((value) => !value),
          captionSize,
          captionColor,
          onCanPlay: () => setPreviewRuntimeState(MEDIA_PREVIEW_STATUS.PLAYABLE),
          onLoadedMetadata: (event) => {
            setPreviewRuntimeState(MEDIA_PREVIEW_STATUS.PLAYABLE);
            setPlaybackDuration(event.currentTarget.duration || 0);
          },
          onLoadStart: () => setPreviewRuntimeState(MEDIA_PREVIEW_STATUS.LOADING),
          onTimeUpdate: (event) => setPlaybackTime(event.currentTarget.currentTime || 0),
          onSeeked: (event) => setPlaybackTime(event.currentTarget.currentTime || 0),
          onError: () => setPreviewRuntimeState(MEDIA_PREVIEW_STATUS.TIMED_OUT),
          loading: previewState === MEDIA_PREVIEW_STATUS.LOADING,
          loadingOverlay: jsx(MediaPreviewFallback, {
            state: MEDIA_PREVIEW_STATUS.LOADING,
            descriptor: previewDescriptor,
            onCopyPath: copyPath,
            onEditPath: startPathEdit,
            onMetadataOnly: showMetadataOnly
          })
        }) : jsx(MediaPreviewFallback, {
          state: previewState,
          descriptor: previewDescriptor,
          onCopyPath: copyPath,
          onEditPath: startPathEdit,
          onMetadataOnly: showMetadataOnly
        }),
        previewState === MEDIA_PREVIEW_STATUS.PLAYABLE && jsxs("div", { className: "border-t border-white/10 bg-gray-950/40 p-4 space-y-3", dir: "rtl", children: [
          jsxs("h3", { className: "flex items-center gap-2 text-sm font-bold text-white", children: [
            jsx(Clock3, { className: "h-4 w-4 va-accent-text" }),
            "إشارات وعلامات زمنية",
            itemBookmarks.length ? jsx("span", { className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-300", children: `${itemBookmarks.length}` }) : null
          ] }),
          jsx(TimeBookmarkButton, {
            getTime: () => videoRef.current?.currentTime ?? 0,
            getSuggestion: (time) => createTranscriptBookmarkDraft({ time, segments: transcriptSegments }),
            onSave: addTimeBookmark
          }),
          jsx(TimeBookmarkTimelineMarkers, {
            bookmarks: itemBookmarks,
            duration: bookmarkDuration,
            currentTime: playbackTime,
            onSeek: seekToBookmark
          }),
          jsx(TimeBookmarkList, {
            bookmarks: itemBookmarks.map((bookmark) => ({
              id: bookmark.id,
              time: bookmark.timestamp,
              title: bookmark.label,
              note: bookmark.description,
              createdAt: bookmark.createdAt
            })),
            onSeek: seekToBookmark,
            onDelete: removeBookmark,
            itemTitle: item.title || ""
          })
        ] }),
        jsxs("div", { className: "p-5", children: [
          jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [
            jsxs("div", { className: "min-w-0 flex-1", children: [
              jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                jsx("h2", { className: "text-2xl font-bold text-white", children: item.title || "بدون عنوان" }),
                jsx(StatusTransitionMenu, {
                  item,
                  role: currentUser?.role || "viewer",
                  onChanged: handleWorkflowChanged
                }),
                item.isFavorite && jsxs("span", { className: "inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/12 px-2 py-0.5 text-xs text-amber-200", children: [jsx(Star, { className: "h-3 w-3 fill-current" }), "مفضلة"] })
              ] }),
              jsx("p", { className: "mt-2 text-sm text-gray-500", children: [getTypeLabel(contentTypes, item.type), getSubtypeLabel(contentTypes, item.type, item.subtype)].filter(Boolean).join(" / ") || "غير مصنف" }),
              mediaPath && jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2", children: [
                jsx("p", { className: "max-w-2xl break-all text-left text-xs text-gray-600", dir: "ltr", children: mediaPath }),
                jsxs("button", { type: "button", onClick: copyPath, className: "inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-white transition-colors", children: [jsx(Copy, { className: "h-3.5 w-3.5" }), "نسخ"] })
              ] }),
              item.isDeleted && jsx("span", { className: "mt-3 inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs text-red-300", children: "محذوف — في سلة المحذوفات" })
            ] }),
            jsxs("div", { className: "flex flex-wrap gap-2", children: [
              jsxs("button", { type: "button", onClick: () => toggleFavorite?.(item.id), className: `inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors ${item.isFavorite ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15" : "border-white/10 text-gray-400 hover:bg-white/5 hover:text-amber-200"}`, children: [jsx(Star, { className: `h-4 w-4 ${item.isFavorite ? "fill-current" : ""}` }), item.isFavorite ? "إزالة المفضلة" : "مفضلة"] }),
              jsxs("button", { type: "button", onClick: () => { setActiveDetailTab("data"); setEditing((value) => !value); }, className: `va-secondary-button inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm transition-colors ${editing ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "text-gray-300 hover:bg-white/5"}`, children: [jsx(PenLine, { className: "h-4 w-4" }), editing ? "إغلاق التحرير" : "تحرير"] }),
              editing && jsx(AutosaveIndicator, { status: autosaveStatus }),
              jsxs("button", { type: "button", onClick: deleteOrRestore, className: "inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition-colors hover:bg-red-500/15", children: [item.isDeleted ? jsx(RefreshCw, { className: "h-4 w-4" }) : jsx(Trash2, { className: "h-4 w-4" }), item.isDeleted ? "استعادة" : "حذف"] })
            ] })
          ] })
        ] })
      ] }),
        ] }),
      jsxs("div", { className: "min-w-0 space-y-6", children: [
      jsx("section", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: itemStats.map((stat, index) => {
        const Icon = stat.icon;
        return jsxs(motion.div, {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.18, delay: index * 0.035 },
          whileHover: { y: -2 },
          className: "va-metric-card rounded-2xl va-surface-muted border p-4 text-right",
          children: [
            jsxs("div", { className: "flex items-start justify-between gap-3", children: [
              jsxs("div", { className: "min-w-0", children: [
                jsx("p", { className: "text-xs text-gray-500", children: stat.label }),
                jsx("p", { className: "mt-2 truncate text-lg font-bold text-white", children: stat.value })
              ] }),
              jsx("span", { className: "va-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", children: jsx(Icon, { className: "h-5 w-5" }) })
            ] })
          ]
        }, stat.id);
      }) }),
      jsx(ResponsiveTabs, {
        tabs: detailTabs,
        activeTab: activeDetailTab,
        onChange: setActiveDetailTab,
        ariaLabel: "تبويبات تفاصيل المادة",
        className: "grid gap-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
      }),
      jsxs("section", { className: `va-card space-y-4 rounded-2xl va-surface-muted border p-5 text-right ${activeDetailTab === "media" ? "" : "hidden"}`, dir: "rtl", children: [
        jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
          jsxs("label", {
            className: "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/5 hover:text-white",
            children: [
              jsx(FileText, { className: "h-3.5 w-3.5" }),
              "تحميل ترجمة (SRT/VTT)",
              jsx("input", {
                type: "file",
                accept: ".srt,.vtt,text/vtt,text/plain",
                className: "hidden",
                onChange: (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const parsed = parseSubtitles(String(reader.result || ""));
                    if (parsed.length) {
                      setImportedCues(parsed);
                      setSubtitlesOn(true);
                      showToast?.(`تم تحميل ${parsed.length} سطر ترجمة`, "success");
                    } else {
                      showToast?.("تعذّر قراءة ملف الترجمة", "error");
                    }
                  };
                  reader.onerror = () => showToast?.("تعذّر قراءة ملف الترجمة", "error");
                  reader.readAsText(file);
                }
              })
            ]
          }),
          importedCues.length > 0 && jsx("button", {
            type: "button",
            onClick: () => setImportedCues([]),
            className: "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-white/5 hover:text-white",
            children: "إزالة الترجمة المستوردة"
          }),
          subtitleCues.length > 0 && jsxs("button", {
            type: "button",
            onClick: () => {
              const srt = transcriptToSrt({ segments: subtitleCues });
              const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = `${(item.title || "subtitles").replace(/[\\/:*?"<>|]+/g, "_")}.srt`;
              anchor.click();
              URL.revokeObjectURL(url);
              showToast?.("تم تنزيل ملف الترجمة SRT", "success");
            },
            className: "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/5 hover:text-white",
            children: [jsx(Download, { className: "h-3.5 w-3.5" }), "تنزيل الترجمة (SRT)"]
          }),
          subtitleCues.length > 0 && jsxs("select", {
            value: captionSize,
            onChange: (event) => setCaptionSize(event.target.value),
            "aria-label": "حجم الترجمة",
            className: "min-h-9 rounded-xl border border-white/10 bg-gray-950/35 px-2 text-xs text-gray-200",
            children: [
              jsx("option", { value: "sm", children: "ترجمة صغيرة" }),
              jsx("option", { value: "md", children: "ترجمة متوسطة" }),
              jsx("option", { value: "lg", children: "ترجمة كبيرة" })
            ]
          }),
          subtitleCues.length > 0 && jsxs("label", {
            className: "inline-flex items-center gap-1.5 text-xs text-gray-400",
            children: [
              "لون",
              jsx("input", {
                type: "color",
                value: captionColor,
                onChange: (event) => setCaptionColor(event.target.value),
                "aria-label": "لون الترجمة",
                className: "h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent"
              })
            ]
          })
        ] }),
        jsx(TranscriptSyncWorkbench, { segments: transcriptSegments, currentTime: playbackTime, onSeek: seekToBookmark }),
        jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
          jsxs("div", { className: "min-w-0", children: [
            jsxs("h2", { className: "flex items-center gap-2 text-lg font-bold text-white", children: [jsx(Sparkles, { className: "h-5 w-5 va-accent-text" }), "أدوات ffmpeg"] }),
            mediaSourceKey ? jsx("p", { dir: "ltr", className: "mt-1 max-w-xl truncate text-left font-mono text-xs text-gray-500", title: mediaSourceKey, children: mediaSourceKey }) : null
          ] }),
          mediaUnavailable ? jsx("span", { className: "rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-100", children: "غير متاح" }) : jsx("span", { className: "rounded-full border va-accent-border va-accent-bg-soft px-3 py-1 text-xs va-accent-text-on-soft", children: "جاهز" })
        ] }),
        mediaUnavailable ? jsx("p", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100", children: mediaUnavailable }) : null,
        jsxs("div", { className: "flex flex-wrap gap-2", children: [
          jsx(MediaToolButton, { icon: jsx(Activity, { className: "h-3.5 w-3.5" }), label: "قراءة البيانات", busy: mediaBusy === "probe", disabled: Boolean(mediaUnavailable), onClick: runProbe }),
          jsx(MediaToolButton, { icon: jsx(ImageIcon, { className: "h-3.5 w-3.5" }), label: "مصغّرة", busy: mediaBusy === "thumbnail", disabled: Boolean(mediaUnavailable), onClick: runThumbnail }),
          jsx(MediaToolButton, { icon: jsx(Music, { className: "h-3.5 w-3.5" }), label: "استخراج صوت", busy: mediaBusy === "audio", disabled: Boolean(mediaUnavailable), onClick: runAudio }),
          jsx(MediaToolButton, { icon: jsx(Video, { className: "h-3.5 w-3.5" }), label: "GIF", busy: mediaBusy === "preview", disabled: Boolean(mediaUnavailable), onClick: runPreviewGif }),
          jsx(MediaToolButton, { icon: jsx(RefreshCw, { className: "h-3.5 w-3.5" }), label: "نسخة ويب", busy: mediaBusy === "transcode", disabled: Boolean(mediaUnavailable), onClick: runTranscode })
        ] }),
        mediaRows.length ? jsx("div", { className: "grid gap-2 sm:grid-cols-2 xl:grid-cols-5", children: mediaRows.map((row) => jsxs("div", { className: "rounded-xl va-surface-subtle border p-3", children: [
          jsx("p", { className: "text-[11px] text-gray-600", children: row.label }),
          jsx("p", { dir: row.dir || "auto", className: "mt-1 truncate text-sm font-semibold text-gray-200", children: row.value })
        ] }, row.id)) }) : null,
        jsxs("div", { className: "space-y-2", children: [
          jsxs("div", { className: "flex items-center justify-between gap-2", children: [
            jsx("h3", { className: "text-sm font-bold text-white", children: "مهام الوسائط" }),
            jsx("button", { type: "button", onClick: refreshMediaJobs, disabled: !mediaToolsEnabled, className: "rounded-lg border border-white/10 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/5 disabled:opacity-40", children: "تحديث" })
          ] }),
          jsx(MediaJobsMiniList, { jobs: mediaJobs, onRetry: retryMediaJob })
        ] })
      ] }),
      activeDetailTab === "data" && editing && draft && jsxs("section", { className: "va-card space-y-4 rounded-2xl border va-accent-border va-accent-bg-soft p-5 text-right", children: [
        jsx("h2", { className: "text-lg font-bold text-white", children: "تحرير التفاصيل" }),
        jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [
          jsxs("label", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [jsx("span", { children: "العنوان" }), jsx("input", { value: draft.title || "", onChange: (event) => updateDraft({ title: event.target.value }), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none" })] }),
          jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [jsx("span", { children: "النوع" }), jsx("select", { value: draft.type || "", onChange: (event) => updateDraft({ type: event.target.value, subtype: "" }), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none", children: contentTypes.filter((type) => type.status !== "archived").map((type) => jsx("option", { value: type.id, children: type.name }, type.id)) })] }),
          jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [jsx("span", { children: "الفرع" }), jsxs("select", { value: draft.subtype || "", onChange: (event) => updateDraft({ subtype: event.target.value }), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none", children: [jsx("option", { value: "", children: "بدون فرع" }), ...subtypes.map((subtype) => jsx("option", { value: subtype.id, children: subtype.name }, subtype.id))] })] }),
          jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [jsx("span", { children: "المسار" }), jsx("input", { ref: pathInputRef, value: draft.path || "", onChange: (event) => updateDraft({ path: event.target.value }), dir: "ltr", className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-left text-sm text-white outline-none" })] }),
          jsxs("div", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [
            jsx("span", { children: "ملف محلي من الجهاز" }),
            jsx(LocalFilePicker, { value: draft.metadata?.localFile, onFileSelect: applyPrimaryLocalFile })
          ] }),
          jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [jsx("span", { children: "الصورة المصغرة" }), jsx("input", { value: draft.thumbnail || "", onChange: (event) => updateDraft({ thumbnail: event.target.value }), dir: "ltr", className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none" })] }),
          canEditTags && jsxs("div", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [
            jsx("label", { className: "block", children: "الوسوم" }),
            jsx("input", { value: draft.tagsText || "", onChange: (event) => updateDraft({ tagsText: event.target.value }), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none" }),
            canManageFieldAcl && jsx(FieldAclControls, { fieldKey: "tags", acl: draft.fieldAcl || {}, onChange: updateFieldAcl })
          ] }),
          canEditNotes && jsxs("div", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [
            jsx("label", { className: "block", children: "ملاحظات" }),
            jsx("textarea", { value: draft.notes || "", onChange: (event) => updateDraft({ notes: event.target.value }), className: "min-h-[90px] w-full va-surface-deep rounded-xl border p-3 text-sm text-white outline-none" }),
            canManageFieldAcl && jsx(FieldAclControls, { fieldKey: "notes", acl: draft.fieldAcl || {}, onChange: updateFieldAcl })
          ] }),
          ai.available && (canEditTags || canEditNotes) && jsx("div", { className: "md:col-span-2", children: jsx(AiAssistBar, { available: ai.available, busy: ai.busy, onSummarize: aiSummarize, onSuggestTags: aiSuggestTags, onProofread: aiProofread, show: { summarize: canEditNotes, proofread: canEditNotes, tags: canEditTags } }) })
        ] }),
        editFields.length > 0 && jsx(GroupedFields, { fields: editFields, gap: "gap-4", renderField: (field) => jsxs("div", { className: `space-y-1 text-sm text-gray-300 ${field.type === "textarea" || field.type === "localFile" ? "md:col-span-2" : ""}`, children: [
          jsx("label", { className: "block", children: field.label }),
          jsx(EditableField, { field, value: draft.metadata?.[fieldKey(field)], onChange: updateMetadata }),
          canManageFieldAcl && jsx(FieldAclControls, { fieldKey: fieldKey(field), acl: draft.fieldAcl || {}, onChange: updateFieldAcl })
        ] }, field.id) }),
        jsxs("div", { className: "flex justify-end gap-2", children: [
          jsx("button", { type: "button", onClick: () => setEditing(false), className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5", children: "إلغاء" }),
          jsx("button", { type: "button", onClick: save, className: "va-primary-button rounded-xl px-4 py-2 text-sm font-semibold text-white", children: "حفظ" })
        ] })
      ] }),
      jsxs("section", { className: "space-y-6", children: [
        jsxs("div", { ref: metadataSectionRef, className: `va-card space-y-4 rounded-2xl va-surface-muted border p-5 text-right ${activeDetailTab === "data" ? "" : "hidden"}`, children: [
          jsxs("h2", { className: "flex items-center gap-2 text-lg font-bold text-white", children: [jsx(FileText, { className: "h-5 w-5 va-accent-text" }), "البيانات"] }),
          completeness && jsxs("div", { className: "rounded-xl va-surface-muted border p-3", children: [
            jsxs("div", { className: "flex items-center justify-between gap-3", children: [
              jsxs("span", { className: "flex items-center gap-2 text-sm font-semibold", style: { color: COMPLETENESS_TIERS[completeness.tier].color }, children: [
                jsx("span", { "aria-hidden": "true", style: { width: "8px", height: "8px", borderRadius: "9999px", background: COMPLETENESS_TIERS[completeness.tier].color, display: "inline-block" } }),
                `جودة التوصيف: ${COMPLETENESS_TIERS[completeness.tier].label}`
              ] }),
              jsx("span", { dir: "ltr", className: "font-mono text-sm text-gray-300", children: `${completeness.percent}%` })
            ] }),
            jsx("div", { className: "mt-2 h-1.5 overflow-hidden rounded-full bg-white/10", children: jsx("div", { className: "h-full rounded-full", style: { width: `${completeness.percent}%`, background: COMPLETENESS_TIERS[completeness.tier].color } }) }),
            completeness.missing.length ? jsxs("p", { className: "mt-2 text-xs leading-6 text-gray-500", children: ["ينقص: ", completeness.missing.join("، ")] }) : jsx("p", { className: "mt-2 text-xs text-gray-500", children: "كل الحقول الأساسية والمطلوبة مكتملة." })
          ] }),
          canViewNotes && item.notes && jsx("p", { className: "rounded-xl va-surface-muted border p-3 text-sm leading-relaxed text-gray-400", dir: "auto", children: renderTextWithTimestamps(item.notes) }),
          canViewPrimaryLocalFile && item.metadata?.localFile && jsxs("div", { className: "rounded-xl va-surface-muted border p-3", children: [
            jsxs("div", { className: "flex items-center gap-2", children: [
              jsx(CheckCircle2, { className: "h-4 w-4 va-accent-text" }),
              jsx("p", { className: "text-xs font-semibold va-accent-text-on-soft", children: "الملف المحلي" })
            ] }),
            jsx("div", { className: "mt-2 text-sm text-gray-300", children: jsx(ReadonlyField, { field: { type: "localFile" }, value: item.metadata.localFile }) })
          ] }),
          readFields.length ? jsx(GroupedFields, { fields: readFields, gap: "gap-3", renderField: (field) => jsxs("div", { className: "rounded-xl va-surface-muted border p-3", children: [
            jsx("p", { className: "text-xs text-gray-600", children: field.label }),
            jsx("div", { className: "mt-1 text-sm text-gray-300", children: jsx(ReadonlyField, { field, value: item.metadata?.[fieldKey(field)] }) })
          ] }, field.id) }) : jsx("p", { className: "text-sm text-gray-500", children: "لا توجد حقول مخصصة لهذا العنصر." }),
          hiddenReadFields > 0 && jsx("p", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100", children: `تم حجب ${formatNumber(hiddenReadFields)} حقل حسب صلاحيات العرض.` })
        ] }),
        jsxs("aside", { className: "va-preview-panel space-y-5 rounded-2xl va-surface-muted border p-5 text-right", children: [
          jsxs("section", { className: activeDetailTab === "data" ? "" : "hidden", children: [
            jsxs("h2", { className: "flex items-center gap-2 text-base font-bold text-white", children: [jsx(Tags, { className: "h-4 w-4 va-accent-text" }), "الوسوم", canViewTags && item.tags?.length ? jsx("span", { className: "mr-auto rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-400", children: item.tags.length }) : null] }),
            canViewTags ? (item.tags?.length ? jsx("div", { className: "mt-3 flex flex-wrap gap-1.5", children: item.tags.map((tag) => jsx("span", { className: "va-tag-chip inline-flex items-center rounded-full border border-white/10 bg-gray-900/60 px-2.5 py-1 text-xs text-gray-300 transition-colors hover:border-emerald-500/25 hover:text-emerald-200", children: tag }, tag)) }) : jsx("p", { className: "mt-3 text-sm text-gray-600", children: "لا توجد وسوم." })) : jsx("p", { className: "mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100", children: "الوسوم محجوبة حسب صلاحيات العرض." })
          ] }),
          jsxs("section", { ref: commentsSectionRef, className: `rounded-xl va-surface-subtle border p-3 ${activeDetailTab === "comments" ? "" : "hidden"}`, children: [
            jsxs("h2", { className: "flex items-center gap-2 text-base font-bold text-white", children: [
              jsx(MessageSquare, { className: "h-4 w-4 va-accent-text" }),
              "التعليقات",
              jsx("span", { className: "mr-auto rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-400", children: itemComments.length })
            ] }),
            jsxs("div", { className: "mt-3 space-y-2", children: [
              jsx(TagAutocomplete, {
                multiline: true,
                value: commentDraft,
                onChange: setCommentDraft,
                rows: 3,
                allowed: ["users", "vocabulary", "tags"],
                placeholder: "اكتب ملاحظة للفريق حول هذه المادة...",
                className: "min-h-[84px] w-full resize-y va-surface-deep rounded-xl border p-3 text-sm text-white outline-none focus:border-emerald-500/40"
              }),
              jsxs("button", {
                type: "button",
                onClick: submitComment,
                disabled: commentBusy || !commentDraft.trim(),
                className: "va-primary-button inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50",
                children: [commentBusy ? jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin" }) : jsx(Send, { className: "h-3.5 w-3.5" }), "إرسال"]
              })
            ] }),
            itemComments.length ? jsx("ul", { className: "mt-4 space-y-2", children: itemComments.map((comment) => jsxs("li", {
              className: "rounded-xl border border-white/10 bg-gray-950/25 p-3",
              children: [
                jsxs("div", { className: "flex items-start justify-between gap-2", children: [
                  jsxs("div", { className: "min-w-0", children: [
                    jsx("p", { className: "truncate text-sm font-semibold text-gray-200", children: comment.author }),
                    jsx("p", { className: "mt-0.5 text-[11px] text-gray-600", children: comment.createdAt ? formatDateTime(comment.createdAt) : "" })
                  ] }),
                  canDeleteComment(comment, currentUser) && jsx("button", {
                    type: "button",
                    onClick: () => removeComment(comment),
                    "aria-label": "حذف التعليق",
                    className: "shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-300",
                    children: jsx(Trash2, { className: "h-3.5 w-3.5" })
                  })
                ] }),
                jsx("p", { className: "mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-300", dir: "auto", children: comment.text })
              ]
            }, comment.id)) }) : jsx("p", { className: "mt-3 text-sm text-gray-600", children: "لا توجد تعليقات بعد." })
          ] }),
          activeDetailTab === "ai" && jsxs("section", { className: "rounded-xl va-surface-subtle border p-4", children: [
            jsxs("h2", { className: "flex items-center gap-2 text-base font-bold text-white", children: [jsx(Sparkles, { className: "h-4 w-4 va-accent-text" }), "مساعد AI للمادة"] }),
            jsx("p", { className: "mt-2 text-sm leading-6 text-gray-500", children: ai.available ? "اختر إجراءً وسيضاف الناتج إلى مسودة التحرير. راجع التغييرات ثم احفظها من تبويب البيانات." : "مزود AI غير متاح حالياً. افتح إعدادات AI أو استخدم الملاحظات اليدوية." }),
            ai.available && jsx("div", { className: "mt-4", children: jsx(AiAssistBar, { available: ai.available, busy: ai.busy, onSummarize: aiSummarize, onSuggestTags: aiSuggestTags, onProofread: aiProofread, show: { summarize: canEditNotes, proofread: canEditNotes, tags: canEditTags } }) }),
            draft && jsx("p", { className: "mt-3 rounded-xl border va-accent-border va-accent-bg-soft p-3 text-xs leading-6 va-accent-text-on-soft", children: editing ? "أنت داخل وضع التحرير. احفظ عند الرضا عن النتيجة." : "سيتم فتح وضع التحرير عند الحاجة للمراجعة والحفظ." })
          ] }),
          activeDetailTab === "notes" ? jsx("section", { children: jsx(ItemNotesPanel, {
            itemId: item.id,
            notes: itemNotes,
            currentUser,
            currentTime: playbackTime,
            canAnchorTime: Boolean(previewSource),
            onAdd: (note) => addItemNote?.(note),
            onRemove: (id) => removeItemNote?.(id),
            onSeek: seekToBookmark
          }) }) : null,
          activeDetailTab === "relations" ? jsxs("section", { className: "space-y-4", children: [
            jsx(RelationsPanel, {
              itemId: item.id,
              itemRelations: explicitItemRelations,
              allItems: videoItems,
              onAddRelation: () => setRelationDialogOpen(true),
              onRemoveRelation: handleRemoveRelation
            }),
            jsx(RelatedContentPanel, { items: relatedItems, onOpenItem: (related) => setSelectedItemId?.(related.id) }),
            jsx(ArchiveImprovementSuggestions, {
              suggestions: visibleImprovementSuggestions,
              onAction: handleImprovementSuggestion,
              onFeedback: handleRecommendationFeedback
            }),
            jsx(AddRelationDialog, {
              isOpen: relationDialogOpen,
              sourceItem: item,
              allItems: videoItems,
              existingRelations: explicitItemRelations.outgoing,
              onAdd: handleAddRelation,
              onClose: () => setRelationDialogOpen(false)
            })
          ] }) : null,
          activeDetailTab === "versions" && item?.id
            ? jsx("section", { className: "rounded-xl va-surface-subtle border", dir: "rtl", "aria-label": "السجل التاريخي للسجل", children: jsx(RecordVersionHistory, { recordId: item.id, store: "videoItems" }) })
            : null,
          activeDetailTab === "history" && itemHistory.length ? jsxs("section", { children: [
            jsxs("h2", { className: "flex items-center gap-2 text-base font-bold text-white", children: [jsx(Clock3, { className: "h-4 w-4 va-accent-text" }), "سجل التعديلات"] }),
            jsx("ul", { className: "mt-3 space-y-2", children: itemHistory.slice(0, 12).map((record) => jsxs("li", { className: "rounded-xl va-surface-subtle border p-3", children: [
              jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                jsx("span", { className: "text-xs text-gray-400", children: formatDateTime(record.timestamp) }),
                jsx("button", { type: "button", onClick: () => restoreVersion(record), className: "shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-gray-300 transition-colors hover:border-emerald-500/30 hover:text-emerald-200", children: "استرجاع" })
              ] }),
              jsx("ul", { className: "mt-1.5 space-y-0.5", children: record.changes.slice(0, 5).map((change, index) => jsxs("li", { className: "truncate text-[11px] text-gray-500", children: [
                jsxs("span", { className: "text-gray-400", children: [change.label, ": "] }),
                jsx("span", { children: describeFieldValue(change.oldValue) }),
                " ← ",
                jsx("span", { className: "text-gray-300", children: describeFieldValue(change.newValue) })
              ] }, `${record.id}-${index}`)) }),
              record.changes.length > 5 ? jsx("p", { className: "mt-1 text-[10px] text-gray-600", children: `+${record.changes.length - 5} تغييرات أخرى` }) : null
            ] }, record.id)) })
          ] }) : null,
          jsxs("section", { className: `rounded-xl va-surface-subtle border p-3 space-y-2 ${activeDetailTab === "history" ? "" : "hidden"}`, children: [
            jsx("h2", { className: "text-xs font-semibold uppercase tracking-wide text-gray-600", children: "معلومات العنصر" }),
            jsxs("div", { className: "space-y-1.5", children: [
              jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                jsx("span", { className: "text-xs text-gray-600", children: "المعرّف" }),
                jsx("span", { className: "min-w-0 max-w-[12rem] truncate text-left font-mono text-xs text-gray-400", dir: "ltr", title: item.id, children: item.id || "—" })
              ] }),
              (item.metadata?.checksum || item.checksum || item.hash) && jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                jsx("span", { className: "text-xs text-gray-600", children: "Checksum" }),
                jsx("span", { className: "min-w-0 max-w-[12rem] truncate text-left font-mono text-xs text-gray-400", dir: "ltr", title: item.metadata?.checksum || item.checksum || item.hash, children: item.metadata?.checksum || item.checksum || item.hash })
              ] }),
              jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                jsx("span", { className: "text-xs text-gray-600", children: "أنشئ" }),
                jsx("span", { className: "text-xs text-gray-400", children: item.createdAt ? formatDateTime(item.createdAt) : "—" })
              ] }),
              jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                jsx("span", { className: "text-xs text-gray-600", children: "آخر تحديث" }),
                jsx("span", { className: "text-xs text-gray-400", children: item.updatedAt ? formatDateTime(item.updatedAt) : "—" })
              ] }),
              jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                jsx("span", { className: "text-xs text-gray-600", children: "الإصدار" }),
                jsx("span", { className: "text-xs text-gray-400", children: `v${formatNumber(item.version || 1)}` })
              ] })
            ] })
          ] }),
          activeDetailTab === "history" && history.length > 0 && jsxs("section", { children: [
            jsx("h2", { className: "text-base font-bold text-white", children: "آخر التغييرات" }),
            jsx("div", { className: "mt-3 space-y-2", children: history.slice(0, 5).map((record) => jsxs("div", { className: "rounded-xl va-surface-subtle border p-3", children: [
              jsx("p", { className: "text-xs font-semibold text-gray-300", children: record.action === "create" ? "إنشاء" : record.action === "update" ? "تعديل" : record.action === "delete" ? "حذف" : record.action === "restore" ? "استعادة" : record.action || "نشاط" }),
              jsx("p", { className: "mt-0.5 text-xs text-gray-600", children: record.timestamp ? formatDateTime(record.timestamp) : "" })
            ] }, record.id)) })
          ] })
        ] })
      ] })
        ] })
      ] }),
      jsx(DraftRecoveryDialog, {
        isOpen: showRecoveryDialog,
        draft: recoveryDraft,
        onRestore: (data) => {
          setDraft((current) => ({ ...current, ...data }));
          setEditing(true);
          setShowRecoveryDialog(false);
          setRecoveryDraft(null);
        },
        onDiscard: () => {
          try { localStorage.removeItem(`edit_item_${item.id}`); } catch { /* ignore */ }
          setShowRecoveryDialog(false);
          setRecoveryDraft(null);
        },
        onClose: () => setShowRecoveryDialog(false)
      }),
      jsx(MobileActionBar, {
        label: "إجراءات التفاصيل",
        actions: [
          { id: "archive", label: "الأرشيف", icon: ArrowRight, onClick: () => setCurrentPage?.("archive") },
          { id: "play", label: "تشغيل", icon: Play, disabled: !previewSource, onClick: () => videoRef.current?.play?.().catch(() => {}) },
          { id: "save", label: "حفظ", icon: Save, primary: true, disabled: !editing || !draft, onClick: save },
          { id: "comment", label: "تعليق", icon: MessageSquare, onClick: () => { setActiveDetailTab("comments"); window.requestAnimationFrame?.(() => commentsSectionRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })); } },
          { id: "edit", label: editing ? "إغلاق" : "تحرير", icon: PenLine, active: editing, onClick: () => { setActiveDetailTab("data"); setEditing((value) => !value); } }
        ]
      })
    ]
  });
}

DetailPage.pageId = "detail";
DetailPage.migrationStatus = "native";

export default DetailPage;
