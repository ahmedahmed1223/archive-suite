import {
  useAppStore
} from "../stores/index.js";
import {
  Clapperboard,
  Download,
  FileJson,
  Flag,
  Film,
  ListVideo,
  MessageSquare,
  PackageCheck,
  Plus,
  Scissors,
  Search,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Archive as ArchiveIcon,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  FileUp,
  FolderPlus,
  Gauge,
  Link,
  Lock,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
  Wand2
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { showConfirm } from "../components/common/ConfirmDialog.js";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { EntityFormModal } from "../components/common/EntityFormModal.jsx";
import { PageHero } from "../components/ui/V1Primitives.jsx";
import { reportError } from "../utils/errorReporting.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";
import {
  addProjectMarker,
  addRoughCut,
  addTemporalComment,
  buildEdl,
  buildMediaReadiness,
  buildMontagePresetClipPatch,
  buildProductionBoardSummary,
  buildProjectDeliveryPackage,
  buildProjectTimeline,
  createProjectValue,
  DEFAULT_TIMELINE_SETTINGS,
  duplicateRoughCut,
  getFilteredProjects,
  getOrderedRoughCuts,
  getProjectDuration,
  getProjectSummary,
  getProjectCommentsForClip,
  isValidRoughCut,
  removeRoughCut,
  reorderRoughCut,
  roughCutDuration,
  secondsToTimecode,
  splitRoughCut,
  MONTAGE_LOOKS,
  MONTAGE_TRANSITIONS,
  MONTAGE_REVIEW_STATUSES
} from "../features/projects/viewModel.js";
import {
  CloudExportError,
  canExportMp4,
  downloadEdl,
  downloadTimelineJson,
  exportProjectMp4,
  hasFfmpegWasmSupport,
  safeFileName,
  triggerDownload
} from "../features/projects/exportClient.js";
import { getBackendUrl, resolveBackendChoice } from "../bootstrap/backendChoice.js";
import { getCloudToken } from "../bootstrap/cloudSession.js";
import { parseVideoTags } from "../features/videos/viewModel.js";
import { TimelineTrack } from "../components/montage/TimelineTrack.jsx";
import { VideoPlayer } from "../components/media/VideoPlayer.jsx";
import { getMediaPreviewDescriptor, MEDIA_PREVIEW_STATUS } from "../features/archive/mediaPreview.js";

/** Friendly clock for a duration in seconds → H:MM:SS or M:SS. */
function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p2 = (n) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${p2(mm)}:${p2(ss)}` : `${mm}:${p2(ss)}`;
}

function itemLabel(item) {
  return (item?.title || "").trim() || item?.path || item?.id || "عنصر";
}

const REVIEW_META = {
  raw: { label: "خام", tone: "border-white/10 bg-white/5 text-gray-300" },
  selected: { label: "مختارة", tone: "border-sky-500/20 bg-sky-500/10 text-sky-100" },
  needs_review: { label: "تحتاج مراجعة", tone: "border-amber-500/20 bg-amber-500/10 text-amber-100" },
  approved: { label: "معتمدة", tone: "va-accent-border va-accent-bg-soft va-accent-text-on-soft" }
};

const TRANSITION_LABELS = {
  cut: "Cut",
  fade: "Fade",
  dissolve: "Dissolve",
  wipeleft: "Wipe Left",
  wiperight: "Wipe Right"
};

const LOOK_LABELS = {
  none: "طبيعي",
  cinematic: "سينمائي",
  news: "إخباري",
  warm: "دافئ",
  mono: "أبيض وأسود"
};

const TIMELINE_ZOOM = [
  { label: "مضغوط", value: 6 },
  { label: "متوازن", value: 12 },
  { label: "تفصيلي", value: 22 }
];

function itemMediaPath(item) {
  return item?.path || item?.filePath || item?.url || item?.metadata?.localFile?.relativePath || "";
}

function readinessTone(status) {
  if (status === "ready") return "va-accent-border va-accent-bg-soft va-accent-text-on-soft";
  if (status === "blocked") return "border-red-500/25 bg-red-500/10 text-red-100";
  return "border-amber-500/25 bg-amber-500/10 text-amber-100";
}

function formatReadiness(readiness) {
  if (readiness.status === "ready") return "جاهزة";
  if (readiness.status === "blocked") return "مصدر مفقود";
  return `ناقص: ${readiness.missing.map((item) => item.label).slice(0, 2).join("، ")}`;
}

function downloadJsonObject(payload, filename) {
  if (typeof Blob === "undefined") return false;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  return triggerDownload(blob, filename);
}

// ── rough-cut builder ────────────────────────────────────────────────────────
function RoughCutBuilder({ items, onAdd }) {
  const [itemId, setItemId] = React.useState(items[0]?.id || "");
  const [inSec, setInSec] = React.useState("0");
  const [outSec, setOutSec] = React.useState("10");
  const [label, setLabel] = React.useState("");
  const itemSelectId = React.useId();
  const inId = React.useId();
  const outId = React.useId();
  const labelId = React.useId();

  React.useEffect(() => {
    if (!items.some((i) => i.id === itemId)) setItemId(items[0]?.id || "");
  }, [items, itemId]);

  const valid = itemId && Number(outSec) > Number(inSec);

  const submit = () => {
    if (!valid) return;
    onAdd({ itemId, inSec: Number(inSec), outSec: Number(outSec), label: label.trim() });
    setLabel("");
  };

  if (!items.length) {
    return jsx("p", {
      className: "rounded-xl border border-dashed border-white/10 bg-gray-950/30 p-4 text-center text-sm text-gray-500",
      children: "أضف فيديوهات إلى الأرشيف أولًا لتتمكّن من تكوين قصاصات."
    });
  }

  return jsxs("div", {
    className: "va-surface-muted rounded-xl border p-3",
    children: [
      jsxs("p", { className: "mb-2 flex items-center gap-2 text-sm font-semibold text-gray-300", children: [
        jsx(Scissors, { className: "h-4 w-4 va-accent-text" }), "إضافة قصاصة (rough cut)"
      ] }),
      jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [
        jsxs("div", { className: "space-y-1 text-sm text-gray-300 sm:col-span-2", children: [
          jsx("label", { htmlFor: itemSelectId, className: "block", children: "المصدر" }),
          jsx("select", {
            id: itemSelectId,
            value: itemId,
            onChange: (e) => setItemId(e.target.value),
            className: "select select-bordered w-full",
            children: items.slice(0, 500).map((item) => jsx("option", { value: item.id, children: itemLabel(item) }, item.id))
          })
        ] }),
        jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("label", { htmlFor: inId, className: "block", children: "بداية (ث)" }),
          jsx("input", { id: inId, type: "number", min: "0", step: "0.1", value: inSec, onChange: (e) => setInSec(e.target.value), className: "input input-bordered w-full" })
        ] }),
        jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("label", { htmlFor: outId, className: "block", children: "نهاية (ث)" }),
          jsx("input", { id: outId, type: "number", min: "0", step: "0.1", value: outSec, onChange: (e) => setOutSec(e.target.value), className: "input input-bordered w-full" })
        ] }),
        jsxs("div", { className: "space-y-1 text-sm text-gray-300 sm:col-span-2", children: [
          jsx("label", { htmlFor: labelId, className: "block", children: "وصف القصاصة (اختياري)" }),
          jsx("input", { id: labelId, value: label, onChange: (e) => setLabel(e.target.value), placeholder: "مثال: لقطة الافتتاح", className: "input input-bordered w-full" })
        ] })
      ] }),
      jsx("div", { className: "mt-2 flex justify-end", children: jsxs("button", {
        type: "button", onClick: submit, disabled: !valid,
        className: "btn btn-primary gap-2",
        children: [jsx(Plus, { className: "h-4 w-4" }), "إضافة للخطّ الزمني"]
      }) })
    ]
  });
}

function SourceBin({ items, query, onQuery, selectedId, onSelect, projectItemIds = [] }) {
  const normalized = query.trim().toLowerCase();
  const filtered = items
    .filter((item) => {
      if (!normalized) return true;
      return [itemLabel(item), item.type, item.subtype, item.path]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    })
    .slice(0, 80);

  return jsxs("section", {
    className: "min-h-0 rounded-2xl border border-white/10 bg-gray-950/35 p-3",
    children: [
      jsxs("div", { className: "mb-3 flex items-center justify-between gap-2", children: [
        jsxs("h3", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(ArchiveIcon, { className: "h-4 w-4 va-accent-text" }), "مكتبة المصادر"] }),
        jsx("span", { className: "rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400", children: formatNumber(filtered.length) })
      ] }),
      jsx("input", {
        value: query,
        onChange: (event) => onQuery(event.target.value),
        placeholder: "بحث في مواد الأرشيف...",
        className: "input input-bordered input-sm mb-3 w-full"
      }),
      filtered.length ? jsx("div", {
        className: "max-h-[34rem] space-y-2 overflow-y-auto pr-1",
        children: filtered.map((item) => {
          const readiness = buildMediaReadiness(item);
          const active = item.id === selectedId;
          const inProject = projectItemIds.includes(item.id);
          return jsxs("button", {
            type: "button",
            onClick: () => onSelect(item.id),
            className: [
              "w-full rounded-xl border p-3 text-right transition-colors",
              active ? "va-accent-border va-accent-bg-soft" : "border-white/10 bg-gray-900/45 hover:border-white/25"
            ].join(" "),
            children: [
              jsxs("div", { className: "flex items-start justify-between gap-2", children: [
                jsxs("div", { className: "min-w-0", children: [
                  jsx("p", { className: "truncate text-sm font-semibold text-white", children: itemLabel(item) }),
                  jsx("p", { className: "mt-1 truncate text-xs text-gray-500", dir: "ltr", children: itemMediaPath(item) || "لا يوجد مسار" })
                ] }),
                inProject && jsx("span", { className: "shrink-0 rounded-full border va-accent-border va-accent-bg-soft px-2 py-0.5 text-[11px] va-accent-text-on-soft", children: "ضمن المشروع" })
              ] }),
              jsx("span", { className: `mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${readinessTone(readiness.status)}`, children: formatReadiness(readiness) })
            ]
          }, item.id);
        })
      }) : jsx("p", { className: "rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-gray-500", children: "لا توجد مصادر مطابقة." })
    ]
  });
}

function MaterialImportPanel({ contentTypes = [], onImport }) {
  const firstType = contentTypes.find((type) => type.status !== "archived") || contentTypes[0];
  const [sourceKind, setSourceKind] = React.useState("path");
  const [title, setTitle] = React.useState("");
  const [path, setPath] = React.useState("");
  const [thumbnail, setThumbnail] = React.useState("");
  const [typeId, setTypeId] = React.useState(firstType?.id || "");
  const [subtypeId, setSubtypeId] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [media, setMedia] = React.useState({ audioKey: "", transcription: "", derivedKey: "" });
  const [saving, setSaving] = React.useState(false);
  const selectedType = contentTypes.find((type) => type.id === typeId);
  const subtypes = selectedType?.subtypes || [];
  const canSubmit = title.trim() && path.trim() && !saving;

  React.useEffect(() => {
    if (typeId && contentTypes.some((type) => type.id === typeId)) return;
    setTypeId(firstType?.id || "");
  }, [contentTypes, firstType?.id, typeId]);

  React.useEffect(() => {
    if (!subtypeId || subtypes.some((subtype) => subtype.id === subtypeId)) return;
    setSubtypeId("");
  }, [subtypeId, subtypes]);

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const created = await onImport?.({
      title: title.trim(),
      path: path.trim(),
      thumbnail: thumbnail.trim(),
      type: typeId,
      subtype: subtypeId,
      notes: notes.trim(),
      tags: parseVideoTags(tags),
      sourceKind,
      media: {
        ...(thumbnail.trim() ? { thumbnailKey: thumbnail.trim() } : {}),
        ...(media.audioKey.trim() ? { audioKey: media.audioKey.trim() } : {}),
        ...(media.transcription.trim() ? { transcription: media.transcription.trim() } : {}),
        ...(media.derivedKey.trim() ? { derivedKey: media.derivedKey.trim() } : {})
      }
    });
    setSaving(false);
    if (!created) return;
    setTitle("");
    setPath("");
    setThumbnail("");
    setSubtypeId("");
    setTags("");
    setNotes("");
    setMedia({ audioKey: "", transcription: "", derivedKey: "" });
  };

  return jsxs("section", {
    className: "rounded-2xl border border-white/10 bg-gray-950/35 p-3",
    "aria-label": "استيراد مواد للمونتاج",
    children: [
      jsxs("div", { className: "mb-3 flex items-center justify-between gap-2", children: [
        jsxs("h3", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(FileUp, { className: "h-4 w-4 va-accent-text" }), "استيراد مواد للمونتاج"] }),
        jsx("span", { className: "rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-gray-400", children: "يرتبط بالمشروع" })
      ] }),
      jsxs("form", { onSubmit: submit, className: "space-y-3", children: [
        jsxs("div", { className: "grid grid-cols-2 gap-2", role: "group", "aria-label": "نوع مصدر المادة", children: [
          jsx("button", { type: "button", onClick: () => setSourceKind("path"), className: `btn btn-sm gap-2 ${sourceKind === "path" ? "btn-primary" : "btn-ghost"}`, children: [jsx(FolderPlus, { className: "h-4 w-4" }), "مسار محلي"] }),
          jsx("button", { type: "button", onClick: () => setSourceKind("url"), className: `btn btn-sm gap-2 ${sourceKind === "url" ? "btn-primary" : "btn-ghost"}`, children: [jsx(Link, { className: "h-4 w-4" }), "رابط"] })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "اسم المادة",
          jsx("input", { value: title, onChange: (e) => setTitle(e.target.value), className: "input input-bordered mt-1 w-full", placeholder: "مثال: مقابلة المصدر الرئيسي" })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          sourceKind === "url" ? "رابط الفيديو أو نسخة الويب" : "مسار ملف المصدر",
          jsx("input", { value: path, onChange: (e) => setPath(e.target.value), dir: "ltr", className: "input input-bordered mt-1 w-full", placeholder: sourceKind === "url" ? "https://..." : "D:\\media\\clip.mp4" })
        ] }),
        jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [
          jsxs("label", { className: "text-xs text-gray-400", children: [
            "نوع المحتوى",
            jsx("select", { value: typeId, onChange: (e) => setTypeId(e.target.value), className: "select select-bordered mt-1 w-full", children: [
              jsx("option", { value: "", children: "بدون تصنيف" }, "empty"),
              ...contentTypes.filter((type) => type.status !== "archived").map((type) => jsx("option", { value: type.id, children: type.name }, type.id))
            ] })
          ] }),
          jsxs("label", { className: "text-xs text-gray-400", children: [
            "الفرع",
            jsx("select", { value: subtypeId, onChange: (e) => setSubtypeId(e.target.value), className: "select select-bordered mt-1 w-full", children: [
              jsx("option", { value: "", children: "بدون فرع" }, "empty"),
              ...subtypes.map((subtype) => jsx("option", { value: subtype.id, children: subtype.name }, subtype.id))
            ] })
          ] })
        ] }),
        jsxs("details", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [
          jsx("summary", { className: "cursor-pointer text-xs font-semibold text-white", children: "جاهزية الوسائط وبيانات إضافية" }),
          jsxs("div", { className: "mt-3 grid gap-2", children: [
            jsxs("label", { className: "text-xs text-gray-400", children: ["Thumbnail", jsx("input", { value: thumbnail, onChange: (e) => setThumbnail(e.target.value), dir: "ltr", className: "input input-bordered mt-1 w-full" })] }),
            jsxs("label", { className: "text-xs text-gray-400", children: ["Audio key/path", jsx("input", { value: media.audioKey, onChange: (e) => setMedia((current) => ({ ...current, audioKey: e.target.value })), dir: "ltr", className: "input input-bordered mt-1 w-full" })] }),
            jsxs("label", { className: "text-xs text-gray-400", children: ["Web proxy/derived", jsx("input", { value: media.derivedKey, onChange: (e) => setMedia((current) => ({ ...current, derivedKey: e.target.value })), dir: "ltr", className: "input input-bordered mt-1 w-full" })] }),
            jsxs("label", { className: "text-xs text-gray-400", children: ["تفريغ مختصر", jsx("textarea", { value: media.transcription, onChange: (e) => setMedia((current) => ({ ...current, transcription: e.target.value })), className: "textarea textarea-bordered mt-1 w-full" })] }),
            jsxs("label", { className: "text-xs text-gray-400", children: ["وسوم", jsx("input", { value: tags, onChange: (e) => setTags(e.target.value), className: "input input-bordered mt-1 w-full", placeholder: "archive, interview, b-roll" })] }),
            jsxs("label", { className: "text-xs text-gray-400", children: ["ملاحظات", jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), className: "textarea textarea-bordered mt-1 w-full" })] })
          ] })
        ] }),
        jsxs("button", { type: "submit", disabled: !canSubmit, className: "btn btn-primary w-full gap-2", children: [jsx(Plus, { className: "h-4 w-4" }), saving ? "جار الاستيراد..." : "استيراد وربط بالمشروع"] })
      ] })
    ]
  });
}

function MaterialInspector({ item, contentTypes = [], projectItemIds = [], onUpdate, onAttach }) {
  const [draft, setDraft] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!item) {
      setDraft(null);
      return;
    }
    const media = item.metadata?.media || {};
    setDraft({
      title: item.title || "",
      path: item.path || item.filePath || item.url || item.metadata?.localFile?.relativePath || "",
      thumbnail: item.thumbnail || media.thumbnailKey || "",
      type: item.type || "",
      subtype: item.subtype || "",
      tags: (item.tags || []).join(", "),
      notes: item.notes || "",
      audioKey: media.audioKey || "",
      transcription: typeof media.transcription === "string" ? media.transcription : "",
      derivedKey: media.derivedKey || ""
    });
  }, [item?.id]);

  if (!item || !draft) {
    return jsxs("section", {
      className: "rounded-2xl border border-dashed border-white/10 bg-gray-950/35 p-4 text-center",
      "aria-label": "إعدادات المادة المحددة",
      children: [
        jsx(Settings2, { className: "mx-auto h-8 w-8 text-gray-600" }),
        jsx("p", { className: "mt-2 text-sm text-gray-500", children: "اختر مادة لضبط إعداداتها وربطها بالمشروع." })
      ]
    });
  }

  const selectedType = contentTypes.find((type) => type.id === draft.type);
  const subtypes = selectedType?.subtypes || [];
  const readiness = buildMediaReadiness({
    ...item,
    path: draft.path,
    thumbnail: draft.thumbnail,
    metadata: {
      ...(item.metadata || {}),
      media: {
        ...(item.metadata?.media || {}),
        thumbnailKey: draft.thumbnail,
        audioKey: draft.audioKey,
        transcription: draft.transcription,
        derivedKey: draft.derivedKey
      }
    }
  });
  const inProject = projectItemIds.includes(item.id);

  const patch = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    await onUpdate?.(item.id, {
      title: draft.title.trim(),
      path: draft.path.trim(),
      thumbnail: draft.thumbnail.trim(),
      type: draft.type,
      subtype: draft.subtype,
      tags: parseVideoTags(draft.tags),
      notes: draft.notes.trim(),
      metadata: {
        ...(item.metadata || {}),
        media: {
          ...(item.metadata?.media || {}),
          ...(draft.thumbnail.trim() ? { thumbnailKey: draft.thumbnail.trim() } : { thumbnailKey: "" }),
          ...(draft.audioKey.trim() ? { audioKey: draft.audioKey.trim() } : { audioKey: "" }),
          ...(draft.transcription.trim() ? { transcription: draft.transcription.trim() } : { transcription: "" }),
          ...(draft.derivedKey.trim() ? { derivedKey: draft.derivedKey.trim() } : { derivedKey: "" })
        },
        montageMaterialUpdatedAt: new Date().toISOString()
      }
    });
    setSaving(false);
  };

  return jsxs("section", {
    className: "rounded-2xl border border-white/10 bg-gray-950/35 p-3",
    "aria-label": "إعدادات المادة المحددة",
    children: [
      jsxs("div", { className: "mb-3 flex items-start justify-between gap-2", children: [
        jsxs("div", { className: "min-w-0", children: [
          jsxs("h3", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(Settings2, { className: "h-4 w-4 va-accent-text" }), "إعدادات المادة المحددة"] }),
          jsx("p", { className: "mt-1 truncate text-xs text-gray-500", dir: "ltr", children: itemMediaPath(item) || "لا يوجد مسار" })
        ] }),
        jsx("span", { className: `shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${readinessTone(readiness.status)}`, children: formatReadiness(readiness) })
      ] }),
      jsxs("div", { className: "grid gap-2", children: [
        jsxs("label", { className: "text-xs text-gray-400", children: ["اسم المادة", jsx("input", { value: draft.title, onChange: (e) => patch("title", e.target.value), className: "input input-bordered mt-1 w-full" })] }),
        jsxs("label", { className: "text-xs text-gray-400", children: ["مسار/رابط المصدر", jsx("input", { value: draft.path, onChange: (e) => patch("path", e.target.value), dir: "ltr", className: "input input-bordered mt-1 w-full" })] }),
        jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [
          jsxs("label", { className: "text-xs text-gray-400", children: [
            "نوع المحتوى",
            jsx("select", { value: draft.type, onChange: (e) => patch("type", e.target.value), className: "select select-bordered mt-1 w-full", children: [
              jsx("option", { value: "", children: "بدون تصنيف" }, "empty"),
              ...contentTypes.filter((type) => type.status !== "archived").map((type) => jsx("option", { value: type.id, children: type.name }, type.id))
            ] })
          ] }),
          jsxs("label", { className: "text-xs text-gray-400", children: [
            "الفرع",
            jsx("select", { value: draft.subtype, onChange: (e) => patch("subtype", e.target.value), className: "select select-bordered mt-1 w-full", children: [
              jsx("option", { value: "", children: "بدون فرع" }, "empty"),
              ...subtypes.map((subtype) => jsx("option", { value: subtype.id, children: subtype.name }, subtype.id))
            ] })
          ] })
        ] }),
        jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [
          jsxs("label", { className: "text-xs text-gray-400", children: ["Thumbnail", jsx("input", { value: draft.thumbnail, onChange: (e) => patch("thumbnail", e.target.value), dir: "ltr", className: "input input-bordered mt-1 w-full" })] }),
          jsxs("label", { className: "text-xs text-gray-400", children: ["Audio", jsx("input", { value: draft.audioKey, onChange: (e) => patch("audioKey", e.target.value), dir: "ltr", className: "input input-bordered mt-1 w-full" })] }),
          jsxs("label", { className: "text-xs text-gray-400", children: ["Web proxy", jsx("input", { value: draft.derivedKey, onChange: (e) => patch("derivedKey", e.target.value), dir: "ltr", className: "input input-bordered mt-1 w-full" })] }),
          jsxs("label", { className: "text-xs text-gray-400", children: ["وسوم", jsx("input", { value: draft.tags, onChange: (e) => patch("tags", e.target.value), className: "input input-bordered mt-1 w-full" })] })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: ["تفريغ أو وصف صوتي", jsx("textarea", { value: draft.transcription, onChange: (e) => patch("transcription", e.target.value), className: "textarea textarea-bordered mt-1 w-full" })] }),
        jsxs("label", { className: "text-xs text-gray-400", children: ["ملاحظات المادة", jsx("textarea", { value: draft.notes, onChange: (e) => patch("notes", e.target.value), className: "textarea textarea-bordered mt-1 w-full" })] }),
        jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [
          jsxs("button", { type: "button", onClick: save, disabled: saving || !draft.title.trim(), className: "btn btn-primary gap-2", children: [jsx(Save, { className: "h-4 w-4" }), saving ? "جار الحفظ..." : "حفظ إعدادات المادة"] }),
          jsxs("button", { type: "button", onClick: () => onAttach?.(item.id), disabled: inProject, className: "btn btn-ghost gap-2", children: [jsx(Plus, { className: "h-4 w-4" }), inProject ? "مرتبطة بالمشروع" : "ربط بالمشروع"] })
        ] })
      ] })
    ]
  });
}

function PreviewComposer({
  item,
  markIn,
  markOut,
  onSetMarkIn,
  onSetMarkOut,
  onAddCut,
  onTimeChange
}) {
  const videoRef = React.useRef(null);
  const [label, setLabel] = React.useState("");
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const path = itemMediaPath(item);
  const descriptor = React.useMemo(
    () => getMediaPreviewDescriptor(path, { runtimeProtocol: typeof window !== "undefined" ? window.location?.protocol || "" : "" }),
    [path]
  );
  const canPreview = descriptor.status === MEDIA_PREVIEW_STATUS.PLAYABLE && descriptor.source;
  const valid = item?.id && Number(markOut) > Number(markIn);

  const setCurrentTime = (value) => {
    const next = Math.max(0, Number(value) || 0);
    setCurrent(next);
    onTimeChange?.(next);
  };

  const add = () => {
    if (!valid) return;
    onAddCut({
      itemId: item.id,
      inSec: Number(markIn),
      outSec: Number(markOut),
      label: label.trim() || itemLabel(item),
      reviewStatus: "selected"
    });
    setLabel("");
  };

  return jsxs("section", {
    className: "rounded-2xl border border-white/10 bg-gray-950/35 p-3",
    children: [
      jsxs("div", { className: "mb-3 flex flex-wrap items-center justify-between gap-2", children: [
        jsxs("h3", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(Eye, { className: "h-4 w-4 va-accent-text" }), "المعاينة وبناء القصاصة"] }),
        jsx("span", { className: "rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400", children: `المؤشر ${formatClock(current)}` })
      ] }),
      canPreview ? jsx("div", { className: "overflow-hidden rounded-xl border border-white/10", children: jsx(VideoPlayer, {
        videoRef,
        src: descriptor.source,
        onLoadedMetadata: (event) => setDuration(Number(event.currentTarget.duration) || 0),
        onTimeUpdate: (event) => setCurrentTime(event.currentTarget.currentTime)
      }) }) : jsxs("div", { className: "flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/50 p-6 text-center", children: [
        jsx("p", { className: "max-w-md text-sm leading-6 text-gray-500", children: item ? "المصدر غير قابل للمعاينة داخل المتصفح، لكن يمكنك استخدامه في القص والتصدير إذا كان متاحًا للخادم." : "اختر مصدرًا من مكتبة المواد." })
      ] }),
      jsxs("div", { className: "mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_auto_auto]", children: [
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "In",
          jsx("input", { type: "number", min: "0", step: "0.1", value: markIn, onChange: (e) => onSetMarkIn(Number(e.target.value)), className: "input input-bordered mt-1 w-full" })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "Out",
          jsx("input", { type: "number", min: "0", step: "0.1", value: markOut, onChange: (e) => onSetMarkOut(Number(e.target.value)), className: "input input-bordered mt-1 w-full" })
        ] }),
        jsx("button", { type: "button", onClick: () => onSetMarkIn(current), className: "btn btn-ghost mt-auto gap-2", children: "Mark In" }),
        jsx("button", { type: "button", onClick: () => onSetMarkOut(duration ? Math.min(duration, Math.max(current, Number(markIn) + 0.5)) : Math.max(current, Number(markIn) + 0.5)), className: "btn btn-ghost mt-auto gap-2", children: "Mark Out" })
      ] }),
      jsxs("div", { className: "mt-2 grid gap-2 lg:grid-cols-[1fr_auto]", children: [
        jsx("input", { value: label, onChange: (e) => setLabel(e.target.value), placeholder: "اسم القصاصة أو وصف سريع", className: "input input-bordered w-full" }),
        jsxs("button", { type: "button", onClick: add, disabled: !valid, className: "btn btn-primary gap-2", children: [jsx(Plus, { className: "h-4 w-4" }), "إضافة للتايملاين"] })
      ] })
    ]
  });
}

function ClipInspector({
  clip,
  item,
  comments,
  onUpdate,
  onRemove,
  onAddComment,
  onSplit,
  onDuplicate,
  currentTime,
  onUseCurrent
}) {
  if (!clip) {
    return jsxs("aside", {
      className: "rounded-2xl border border-dashed border-white/10 bg-gray-950/35 p-4 text-center",
      children: [
        jsx(SlidersHorizontal, { className: "mx-auto h-8 w-8 text-gray-600" }),
        jsx("p", { className: "mt-2 text-sm text-gray-500", children: "اختر قصاصة من الخط الزمني لتحرير خصائصها." })
      ]
    });
  }
  const meta = REVIEW_META[clip.reviewStatus] || REVIEW_META.raw;
  const transition = clip.transition || { type: "cut", durationSec: 0 };
  const filters = clip.filters || { look: "none", brightness: 0, contrast: 1, saturation: 1 };
  const transform = clip.transform || { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 };
  const midpoint = Number(clip.inSec) + roughCutDuration(clip) / 2;
  const patchNested = (key, patch) => onUpdate({ [key]: { ...(clip[key] || {}), ...patch } });
  const applyPreset = (preset) => onUpdate(buildMontagePresetClipPatch(preset));
  return jsxs("aside", {
    className: "rounded-2xl border border-white/10 bg-gray-950/35 p-4",
    children: [
      jsxs("div", { className: "mb-3 flex items-start justify-between gap-2", children: [
        jsxs("div", { className: "min-w-0", children: [
          jsx("h3", { className: "truncate text-sm font-semibold text-white", children: clip.label || itemLabel(item) }),
          jsx("p", { className: "mt-1 truncate text-xs text-gray-500", children: itemLabel(item) })
        ] }),
        jsx("span", { className: `shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${meta.tone}`, children: meta.label })
      ] }),
      jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [
        jsxs("label", { className: "text-xs text-gray-400 sm:col-span-2", children: [
          "اسم القصاصة",
          jsx("input", { value: clip.label || "", onChange: (e) => onUpdate({ label: e.target.value }), className: "input input-bordered mt-1 w-full" })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "In",
          jsx("input", { type: "number", min: "0", step: "0.1", disabled: clip.locked, value: clip.inSec, onChange: (e) => onUpdate({ inSec: Number(e.target.value) }), className: "input input-bordered mt-1 w-full" })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "Out",
          jsx("input", { type: "number", min: "0", step: "0.1", disabled: clip.locked, value: clip.outSec, onChange: (e) => onUpdate({ outSec: Number(e.target.value) }), className: "input input-bordered mt-1 w-full" })
        ] }),
        jsx("button", { type: "button", disabled: clip.locked, onClick: () => onUseCurrent("inSec", currentTime), className: "btn btn-ghost btn-sm", children: "استخدم المؤشر كبداية" }),
        jsx("button", { type: "button", disabled: clip.locked, onClick: () => onUseCurrent("outSec", currentTime), className: "btn btn-ghost btn-sm", children: "استخدم المؤشر كنهاية" }),
        jsxs("div", { className: "grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:col-span-2", children: [
          jsxs("div", { className: "flex items-center justify-between gap-2", children: [
            jsxs("p", { className: "flex items-center gap-2 text-xs font-semibold text-white", children: [jsx(Scissors, { className: "h-4 w-4 va-accent-text" }), "أدوات القطع" ] }),
            jsx("span", { className: "text-[11px] text-gray-500", children: `المدة ${formatClock(roughCutDuration(clip))}` })
          ] }),
          jsxs("div", { className: "grid gap-2 sm:grid-cols-3", children: [
            jsx("button", { type: "button", disabled: clip.locked, onClick: () => onSplit?.(currentTime), className: "btn btn-ghost btn-sm", children: "قص عند المؤشر" }),
            jsx("button", { type: "button", disabled: clip.locked, onClick: () => onSplit?.(midpoint), className: "btn btn-ghost btn-sm", children: "قص في المنتصف" }),
            jsxs("button", { type: "button", onClick: onDuplicate, className: "btn btn-ghost btn-sm gap-2", children: [jsx(Copy, { className: "h-4 w-4" }), "نسخ القصاصة"] })
          ] })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "المراجعة",
          jsx("select", { value: clip.reviewStatus || "raw", onChange: (e) => onUpdate({ reviewStatus: e.target.value }), className: "select select-bordered mt-1 w-full", children: MONTAGE_REVIEW_STATUSES.map((status) => jsx("option", { value: status, children: REVIEW_META[status]?.label || status }, status)) })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "المسار",
          jsx("input", { value: clip.trackId || "v1", onChange: (e) => onUpdate({ trackId: e.target.value }), className: "input input-bordered mt-1 w-full" })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "اللون",
          jsx("input", { type: "color", value: clip.color || "#22c55e", onChange: (e) => onUpdate({ color: e.target.value }), className: "mt-1 h-10 w-full rounded-lg border border-white/10 bg-transparent p-1" })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "الصوت dB",
          jsx("input", { type: "number", min: "-60", max: "12", step: "1", value: clip.volumeDb ?? 0, onChange: (e) => onUpdate({ volumeDb: Number(e.target.value) }), className: "input input-bordered mt-1 w-full" })
        ] }),
        jsxs("label", { className: "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-300 sm:col-span-2", children: [
          jsx("input", { type: "checkbox", checked: Boolean(clip.locked), onChange: (e) => onUpdate({ locked: e.target.checked }), className: "checkbox checkbox-sm" }),
          jsx(Lock, { className: "h-4 w-4 text-gray-500" }),
          "قفل القصاصة من التحريك والقص"
        ] }),
        jsxs("label", { className: "text-xs text-gray-400 sm:col-span-2", children: [
          "ملاحظات زمنية",
          jsx("textarea", { value: clip.notes || "", onChange: (e) => onUpdate({ notes: e.target.value }), className: "textarea textarea-bordered mt-1 w-full", placeholder: "ملاحظة للمراجعة أو الاعتماد..." })
        ] }),
        jsxs("section", { className: "rounded-xl border border-white/10 bg-white/5 p-3 sm:col-span-2", children: [
          jsxs("div", { className: "mb-2 flex items-center justify-between gap-2", children: [
            jsxs("p", { className: "flex items-center gap-2 text-xs font-semibold text-white", children: [jsx(Film, { className: "h-4 w-4 va-accent-text" }), "الانتقال" ] }),
            jsx("span", { className: "text-[11px] text-gray-500", children: transition.type === "cut" ? "بدون مزج" : `${transition.durationSec || 0.5}s` })
          ] }),
          jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [
            jsxs("label", { className: "text-xs text-gray-400", children: [
              "نوع الانتقال",
              jsx("select", {
                value: transition.type || "cut",
                onChange: (e) => patchNested("transition", { type: e.target.value, durationSec: e.target.value === "cut" ? 0 : transition.durationSec || 0.5 }),
                className: "select select-bordered mt-1 w-full",
                children: MONTAGE_TRANSITIONS.map((type) => jsx("option", { value: type, children: TRANSITION_LABELS[type] || type }, type))
              })
            ] }),
            jsxs("label", { className: "text-xs text-gray-400", children: [
              "مدة الانتقال",
              jsx("input", {
                type: "number",
                min: "0.1",
                max: "5",
                step: "0.1",
                disabled: transition.type === "cut",
                value: transition.durationSec || 0,
                onChange: (e) => patchNested("transition", { durationSec: Number(e.target.value) }),
                className: "input input-bordered mt-1 w-full"
              })
            ] })
          ] })
        ] }),
        jsxs("section", { className: "rounded-xl border border-white/10 bg-white/5 p-3 sm:col-span-2", children: [
          jsxs("div", { className: "mb-2 flex items-center justify-between gap-2", children: [
            jsxs("p", { className: "flex items-center gap-2 text-xs font-semibold text-white", children: [jsx(Wand2, { className: "h-4 w-4 va-accent-text" }), "فلاتر وتصحيح اللون" ] }),
            jsx("button", { type: "button", onClick: () => applyPreset("none"), className: "btn btn-ghost btn-xs", children: "Reset" })
          ] }),
          jsx("div", { className: "mb-3 flex flex-wrap gap-2", children: MONTAGE_LOOKS.map((look) => jsx("button", {
            type: "button",
            onClick: () => applyPreset(look),
            className: `rounded-lg border px-2 py-1 text-xs ${filters.look === look ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 bg-white/5 text-gray-300 hover:border-white/25"}`,
            children: LOOK_LABELS[look] || look
          }, look)) }),
          jsxs("div", { className: "grid gap-2 sm:grid-cols-3", children: [
            jsxs("label", { className: "text-xs text-gray-400", children: [
              `Brightness ${filters.brightness ?? 0}`,
              jsx("input", { type: "range", min: "-1", max: "1", step: "0.05", value: filters.brightness ?? 0, onChange: (e) => patchNested("filters", { brightness: Number(e.target.value) }), className: "range range-xs mt-2" })
            ] }),
            jsxs("label", { className: "text-xs text-gray-400", children: [
              `Contrast ${filters.contrast ?? 1}`,
              jsx("input", { type: "range", min: "0", max: "3", step: "0.05", value: filters.contrast ?? 1, onChange: (e) => patchNested("filters", { contrast: Number(e.target.value) }), className: "range range-xs mt-2" })
            ] }),
            jsxs("label", { className: "text-xs text-gray-400", children: [
              `Saturation ${filters.saturation ?? 1}`,
              jsx("input", { type: "range", min: "0", max: "3", step: "0.05", value: filters.saturation ?? 1, onChange: (e) => patchNested("filters", { saturation: Number(e.target.value) }), className: "range range-xs mt-2" })
            ] })
          ] })
        ] }),
        jsxs("section", { className: "rounded-xl border border-white/10 bg-white/5 p-3 sm:col-span-2", children: [
          jsxs("div", { className: "mb-2 flex items-center justify-between gap-2", children: [
            jsxs("p", { className: "flex items-center gap-2 text-xs font-semibold text-white", children: [jsx(SlidersHorizontal, { className: "h-4 w-4 va-accent-text" }), "Transformation" ] }),
            jsx("button", { type: "button", onClick: () => onUpdate({ transform: buildMontagePresetClipPatch("none").transform }), className: "btn btn-ghost btn-xs", children: "Reset" })
          ] }),
          jsxs("div", { className: "grid gap-2 sm:grid-cols-3", children: [
            jsxs("label", { className: "text-xs text-gray-400", children: [
              "Scale",
              jsx("input", { type: "number", min: "0.1", max: "5", step: "0.05", value: transform.scale ?? 1, onChange: (e) => patchNested("transform", { scale: Number(e.target.value) }), className: "input input-bordered mt-1 w-full" })
            ] }),
            jsxs("label", { className: "text-xs text-gray-400", children: [
              "X",
              jsx("input", { type: "number", step: "1", value: transform.x ?? 0, onChange: (e) => patchNested("transform", { x: Number(e.target.value) }), className: "input input-bordered mt-1 w-full" })
            ] }),
            jsxs("label", { className: "text-xs text-gray-400", children: [
              "Y",
              jsx("input", { type: "number", step: "1", value: transform.y ?? 0, onChange: (e) => patchNested("transform", { y: Number(e.target.value) }), className: "input input-bordered mt-1 w-full" })
            ] }),
            jsxs("label", { className: "text-xs text-gray-400", children: [
              "Rotation",
              jsx("input", { type: "number", min: "-180", max: "180", step: "1", value: transform.rotation ?? 0, onChange: (e) => patchNested("transform", { rotation: Number(e.target.value) }), className: "input input-bordered mt-1 w-full" })
            ] }),
            jsxs("label", { className: "text-xs text-gray-400 sm:col-span-2", children: [
              `Opacity ${Math.round((transform.opacity ?? 1) * 100)}%`,
              jsx("input", { type: "range", min: "0", max: "1", step: "0.05", value: transform.opacity ?? 1, onChange: (e) => patchNested("transform", { opacity: Number(e.target.value) }), className: "range range-xs mt-2" })
            ] })
          ] })
        ] })
      ] }),
      jsx("button", { type: "button", onClick: onRemove, className: "mt-3 inline-flex items-center gap-2 rounded-xl border border-red-500/20 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10", children: [jsx(Trash2, { className: "h-4 w-4" }), "حذف القصاصة"] })
      ,
      jsx(TemporalCommentsPanel, { clip, comments, currentTime, onAddComment })
    ]
  });
}

function TimelineSettingsPanel({ settings, onChange }) {
  const current = { ...DEFAULT_TIMELINE_SETTINGS, ...(settings || {}) };
  return jsxs("section", {
    className: "rounded-2xl border border-white/10 bg-gray-950/35 p-3",
    children: [
      jsxs("h3", { className: "mb-3 flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(Gauge, { className: "h-4 w-4 va-accent-text" }), "إعدادات المشروع"] }),
      jsxs("div", { className: "grid gap-2 sm:grid-cols-3", children: [
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "FPS",
          jsx("input", { type: "number", min: "1", step: "1", value: current.fps, onChange: (e) => onChange({ ...current, fps: Number(e.target.value) }), className: "input input-bordered mt-1 w-full" })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "الدقة",
          jsx("input", { value: current.resolution, onChange: (e) => onChange({ ...current, resolution: e.target.value }), className: "input input-bordered mt-1 w-full" })
        ] }),
        jsxs("label", { className: "text-xs text-gray-400", children: [
          "النسبة",
          jsx("input", { value: current.aspectRatio, onChange: (e) => onChange({ ...current, aspectRatio: e.target.value }), className: "input input-bordered mt-1 w-full" })
        ] })
      ] })
    ]
  });
}

function MarkerPanel({ markers = [], currentTime = 0, onAddMarker }) {
  const [label, setLabel] = React.useState("");
  const add = () => {
    const clean = label.trim();
    if (!clean) return;
    onAddMarker?.({ atSec: currentTime, label: clean });
    setLabel("");
  };

  return jsxs("section", {
    className: "rounded-2xl border border-white/10 bg-gray-950/35 p-3",
    children: [
      jsxs("div", { className: "mb-3 flex items-center justify-between gap-2", children: [
        jsxs("h3", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(Flag, { className: "h-4 w-4 va-accent-text" }), "Markers"] }),
        jsx("span", { className: "rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400", children: formatClock(currentTime) })
      ] }),
      jsxs("div", { className: "grid gap-2 sm:grid-cols-[1fr_auto]", children: [
        jsx("input", { value: label, onChange: (event) => setLabel(event.target.value), placeholder: "علامة زمنية: افتتاح، ذروة، نهاية...", className: "input input-bordered input-sm w-full" }),
        jsx("button", { type: "button", onClick: add, disabled: !label.trim(), className: "btn btn-primary btn-sm", children: "إضافة" })
      ] }),
      markers.length ? jsx("div", {
        className: "mt-3 space-y-2",
        children: [...markers].sort((a, b) => a.atSec - b.atSec).slice(0, 6).map((marker) => jsxs("div", { className: "flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs", children: [
          jsx("span", { className: "truncate text-gray-200", children: marker.label }),
          jsx("span", { className: "tabular-nums text-gray-500", children: formatClock(marker.atSec) })
        ] }, marker.id))
      }) : jsx("p", { className: "mt-3 text-xs text-gray-500", children: "لا توجد markers بعد." })
    ]
  });
}

function TemporalCommentsPanel({ clip, comments = [], currentTime = 0, onAddComment }) {
  const [body, setBody] = React.useState("");
  const add = () => {
    const clean = body.trim();
    if (!clean || !clip) return;
    onAddComment?.({ clipId: clip.id, itemId: clip.itemId, atSec: currentTime, body: clean });
    setBody("");
  };

  return jsxs("section", {
    className: "mt-4 rounded-2xl border border-white/10 bg-white/5 p-3",
    children: [
      jsxs("div", { className: "mb-2 flex items-center justify-between gap-2", children: [
        jsxs("h4", { className: "flex items-center gap-2 text-xs font-semibold text-white", children: [jsx(MessageSquare, { className: "h-4 w-4 va-accent-text" }), "تعليقات زمنية"] }),
        jsx("span", { className: "rounded-full bg-black/20 px-2 py-0.5 text-[11px] text-gray-400", children: formatClock(currentTime) })
      ] }),
      jsxs("div", { className: "grid gap-2", children: [
        jsx("textarea", { value: body, onChange: (event) => setBody(event.target.value), disabled: !clip, className: "textarea textarea-bordered min-h-20 w-full", placeholder: clip ? "تعليق مرتبط بهذه القصاصة والزمن الحالي..." : "اختر قصاصة أولًا" }),
        jsx("button", { type: "button", onClick: add, disabled: !clip || !body.trim(), className: "btn btn-ghost btn-sm justify-self-start", children: "إضافة تعليق" })
      ] }),
      comments.length ? jsx("div", {
        className: "mt-3 space-y-2",
        children: comments.slice(0, 5).map((comment) => jsxs("article", { className: "rounded-xl border border-white/10 bg-gray-950/40 p-2 text-xs", children: [
          jsxs("div", { className: "mb-1 flex items-center justify-between gap-2", children: [
            jsx("span", { className: comment.status === "resolved" ? "text-emerald-200" : "text-amber-200", children: comment.status === "resolved" ? "محلول" : "مفتوح" }),
            jsx("span", { className: "tabular-nums text-gray-500", children: formatClock(comment.atSec) })
          ] }),
          jsx("p", { className: "leading-5 text-gray-300", children: comment.body })
        ] }, comment.id))
      }) : jsx("p", { className: "mt-3 text-xs text-gray-500", children: "لا توجد تعليقات على هذه القصاصة." })
    ]
  });
}

function ExportCenter({ canExport, exportMode = "server", serverFfmpeg, hasValidCuts, exporting, onExport, onDownloadPackage, exportEvents = [] }) {
  const exportStateLabel = canExport
    ? exportMode === "wasm" ? "MP4 عبر wasm" : "MP4 جاهز"
    : "MP4 يحتاج خادمًا أو wasm";
  const ffmpegDetail = serverFfmpeg
    ? serverFfmpeg.available
      ? `ffmpeg ${serverFfmpeg.version || ""}`.trim()
      : serverFfmpeg.code === "FFMPEG_MISSING" ? "ffmpeg غير مثبت على الخادم" : "تعذّر فحص ffmpeg"
    : exportMode === "wasm" ? "سيستخدم ffmpeg.wasm المتاح في المتصفح" : "لم يتم فحص خادم التصدير بعد";
  return jsxs("section", {
    className: "rounded-2xl border border-white/10 bg-gray-950/35 p-3",
    children: [
      jsxs("div", { className: "mb-3 flex items-center justify-between gap-2", children: [
        jsxs("h3", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(Download, { className: "h-4 w-4 va-accent-text" }), "مركز التصدير"] }),
        jsx("span", { className: `rounded-full border px-2 py-0.5 text-xs ${canExport ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-amber-500/25 bg-amber-500/10 text-amber-100"}`, children: exportStateLabel })
      ] }),
      jsxs("div", { className: "flex flex-wrap gap-2", children: [
        jsxs("button", { type: "button", onClick: () => onExport("json"), disabled: !hasValidCuts, className: "btn btn-ghost gap-2", children: [jsx(FileJson, { className: "h-4 w-4" }), "JSON"] }),
        jsxs("button", { type: "button", onClick: () => onExport("edl"), disabled: !hasValidCuts, className: "btn btn-ghost gap-2", children: [jsx(Download, { className: "h-4 w-4" }), "EDL"] }),
        jsxs("button", { type: "button", onClick: () => onExport("mp4"), disabled: !canExport || exporting || !hasValidCuts, className: "btn btn-primary gap-2", children: [jsx(Film, { className: "h-4 w-4" }), exporting ? "جارٍ تصدير MP4..." : "MP4"] }),
        jsxs("button", { type: "button", onClick: onDownloadPackage, disabled: !hasValidCuts, className: "btn btn-ghost gap-2", children: [jsx(PackageCheck, { className: "h-4 w-4" }), "حزمة تسليم"] })
      ] }),
      jsx("p", { className: serverFfmpeg?.available || exportMode === "wasm" ? "mt-3 text-xs text-emerald-200" : "mt-3 text-xs text-amber-200", children: ffmpegDetail }),
      exportEvents.length ? jsx("div", {
        className: "mt-3 space-y-2",
        children: exportEvents.slice(0, 3).map((event) => jsxs("div", { className: "flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs", children: [
          jsx("span", { className: event.ok ? "text-emerald-200" : "text-red-200", children: event.label }),
          jsx("span", { className: "text-gray-500", children: event.time })
        ] }, event.id))
      }) : jsx("p", { className: "mt-3 text-xs text-gray-500", children: "لم يتم إنشاء تصديرات في هذه الجلسة بعد." })
    ]
  });
}

function ProductionBoard({ summary }) {
  const cells = [
    ["مشاريع نشطة", summary.activeProjects, Clapperboard],
    ["مهام مفتوحة", summary.openTasks, ClipboardList],
    ["قصاصات معتمدة", summary.approvedClips, CheckCircle2],
    ["تعليقات مفتوحة", summary.unresolvedComments, MessageSquare],
    ["جاهزة للتسليم", summary.deliverableProjects, PackageCheck],
    ["تنبيهات وسائط", summary.mediaWarnings, Gauge]
  ];

  return jsx("section", {
    className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-6",
    children: cells.map(([label, value, Icon]) => jsxs("div", { className: "rounded-2xl border va-surface-muted p-4 text-right", children: [
      jsxs("div", { className: "flex items-center justify-between gap-2", children: [
        jsx("span", { className: "text-sm text-gray-500", children: label }),
        jsx(Icon, { className: "h-4 w-4 va-accent-text" })
      ] }),
      jsx("p", { className: "mt-2 text-2xl font-bold text-white", children: formatNumber(value) })
    ] }, label))
  });
}

// ── timeline row ─────────────────────────────────────────────────────────────
function TimelineRow({ cut, index, total, itemsById, onMove, onRemove }) {
  const item = itemsById.get(cut.itemId);
  const valid = isValidRoughCut(cut);
  const title = cut.label || itemLabel(item);
  return jsxs("div", {
    className: `grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3 ${valid ? "va-surface-muted" : "border-amber-500/30 bg-amber-500/5"}`,
    children: [
      jsx("span", { className: "flex h-7 w-7 items-center justify-center rounded-lg va-accent-bg-soft text-xs font-bold va-accent-text-on-soft", children: index + 1 }),
      jsxs("div", { className: "min-w-0", children: [
        jsx("p", { className: "truncate text-sm font-semibold text-white", children: title }),
        jsxs("p", { className: "mt-0.5 text-xs text-gray-500", children: [
          `${secondsToTimecode(cut.inSec)} ← ${secondsToTimecode(cut.outSec)}`,
          jsx("span", { className: "mx-2 text-gray-700", children: "·" }),
          `${formatClock(roughCutDuration(cut))}`,
          !valid && jsx("span", { className: "mr-2 text-amber-300", children: "· قصاصة غير صالحة" })
        ] })
      ] }),
      jsxs("div", { className: "flex shrink-0 items-center gap-1", children: [
        jsx("button", { type: "button", disabled: index === 0, onClick: () => onMove(cut.id, index - 1), "aria-label": "تحريك لأعلى", className: "rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30", children: jsx(ChevronUp, { className: "h-4 w-4" }) }),
        jsx("button", { type: "button", disabled: index === total - 1, onClick: () => onMove(cut.id, index + 1), "aria-label": "تحريك لأسفل", className: "rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30", children: jsx(ChevronDown, { className: "h-4 w-4" }) }),
        jsx("button", { type: "button", onClick: () => onRemove(cut.id), "aria-label": "حذف القصاصة", className: "rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-300", children: jsx(Trash2, { className: "h-4 w-4" }) })
      ] })
    ]
  }, cut.id);
}

// ── project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, active, index, onOpen, onDelete }) {
  const cuts = project.roughCuts?.length || 0;
  const validCuts = (project.roughCuts || []).filter(isValidRoughCut).length;
  const openTasks = (project.tasks || []).filter((task) => task.status !== "done").length;
  const duration = getProjectDuration(project);
  return jsxs(motion.article, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 10) * 0.025 },
    onClick: onOpen,
    className: `va-entity-card cursor-pointer rounded-2xl border p-4 text-right transition-all ${active ? "va-accent-border va-accent-bg-soft" : "border-white/10 bg-gray-900/45 hover:border-white/20"}`,
    dir: "rtl",
    children: [
      jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
          jsx("span", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl va-accent-bg-soft va-accent-text-on-soft", children: jsx(Clapperboard, { className: "h-5 w-5" }) }),
          jsxs("div", { className: "min-w-0", children: [
            jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              jsx("h3", { className: "truncate text-base font-bold text-white", children: project.name || "مشروع بدون اسم" }),
              project.status === "archived" && jsx("span", { className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-400", children: "مؤرشف" })
            ] }),
            project.description && jsx("p", { className: "mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500", children: project.description })
          ] })
        ] }),
        jsx("div", { className: "flex shrink-0 gap-1", onClick: (e) => e.stopPropagation(), children: jsx("button", { type: "button", onClick: onDelete, className: "rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-300", "aria-label": `حذف ${project.name}`, children: jsx(Trash2, { className: "h-4 w-4" }) }) })
      ] }),
      jsxs("div", { className: "mt-3 grid grid-cols-3 gap-2 text-xs", children: [
        jsxs("span", { className: "rounded-lg border border-white/10 bg-white/5 p-2", children: [jsx("b", { className: "block text-white", children: `${formatNumber(validCuts)}/${formatNumber(cuts)}` }), jsx("span", { className: "text-gray-500", children: "قصاصات" })] }),
        jsxs("span", { className: "rounded-lg border border-white/10 bg-white/5 p-2", children: [jsx("b", { className: "block text-white", children: formatClock(duration) }), jsx("span", { className: "text-gray-500", children: "مدة" })] }),
        jsxs("span", { className: openTasks ? "rounded-lg border border-amber-500/20 bg-amber-500/10 p-2" : "rounded-lg border border-white/10 bg-white/5 p-2", children: [jsx("b", { className: openTasks ? "block text-amber-100" : "block text-white", children: formatNumber(openTasks) }), jsx("span", { className: "text-gray-500", children: "مهام" })] })
      ] }),
      project.updatedAt && jsx("p", { className: "mt-3 text-xs text-gray-700", children: `آخر تحديث: ${formatDateTime(project.updatedAt)}` })
    ]
  }, project.id);
}

// ── editor panel ─────────────────────────────────────────────────────────────
function ProjectEditor({
  project, items, itemsById, onPatch,
  onAddCut, onMoveCut, onRemoveCut, onUpdateCut, onSplitCut, onDuplicateCut, onReorderClips,
  onAddMarker, onAddComment, onImportMaterial, onUpdateMaterial, onAttachMaterial,
  onExport, onDownloadPackage, mp4Enabled, mp4Mode, serverFfmpeg, exporting, exportEvents,
  contentTypes, onOpenProductionTasks, onBack
}) {
  const [sourceQuery, setSourceQuery] = React.useState("");
  const [selectedSourceId, setSelectedSourceId] = React.useState(project?.itemIds?.[0] || items[0]?.id || "");
  const [selectedClipId, setSelectedClipId] = React.useState(null);
  const [markIn, setMarkIn] = React.useState(0);
  const [markOut, setMarkOut] = React.useState(10);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [timelineZoom, setTimelineZoom] = React.useState(12);

  React.useEffect(() => {
    const nextSource = project?.itemIds?.find((id) => itemsById.has(id)) || items[0]?.id || "";
    setSelectedSourceId((current) => (current && itemsById.has(current) ? current : nextSource));
  }, [items, itemsById, project?.id, project?.itemIds]);

  React.useEffect(() => {
    const ordered = getOrderedRoughCuts(project);
    setSelectedClipId((current) => (current && ordered.some((clip) => clip.id === current) ? current : ordered[0]?.id || null));
  }, [project]);

  if (!project) {
    return jsxs("section", {
      className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35 p-8 text-center",
      children: [
        jsx(Film, { className: "mx-auto h-12 w-12 text-gray-600" }),
        jsx("h2", { className: "mt-3 text-lg font-bold text-white", children: "اختر مشروعًا" }),
        jsx("p", { className: "mt-2 text-sm text-gray-500", children: "ستظهر هنا تفاصيل المشروع، بناء القصاصات، والخطّ الزمني." })
      ]
    });
  }

  const ordered = getOrderedRoughCuts(project);
  const total = getProjectDuration(project);
  const selectedSource = itemsById.get(selectedSourceId) || items[0] || null;
  const selectedClip = ordered.find((clip) => clip.id === selectedClipId) || null;
  const selectedClipItem = selectedClip ? itemsById.get(selectedClip.itemId) : null;
  const selectedClipComments = selectedClip ? getProjectCommentsForClip(project, selectedClip.id) : [];
  const validCuts = ordered.filter(isValidRoughCut);
  const approvedCount = ordered.filter((clip) => clip.reviewStatus === "approved").length;
  const mediaIssues = project.itemIds
    .map((id) => itemsById.get(id))
    .filter(Boolean)
    .map((item) => buildMediaReadiness(item))
    .filter((readiness) => readiness.status !== "ready").length;

  const updateClip = (patch) => {
    if (!selectedClip) return;
    onUpdateCut?.(selectedClip.id, patch);
  };

  const useCurrentOnClip = (field, value) => {
    if (!selectedClip || selectedClip.locked) return;
    const next = Math.max(0, Number(value) || 0);
    if (field === "inSec") updateClip({ inSec: Math.min(next, selectedClip.outSec) });
    else updateClip({ outSec: Math.max(next, selectedClip.inSec) });
  };

  const splitSelectedClip = (atSec) => {
    if (!selectedClip) return;
    onSplitCut?.(selectedClip.id, atSec);
  };

  const duplicateSelectedClip = () => {
    if (!selectedClip) return;
    onDuplicateCut?.(selectedClip.id);
  };

  return jsxs("section", {
    className: "va-preview-panel space-y-4 rounded-2xl va-surface-muted border p-4 text-right",
    dir: "rtl",
    children: [
      jsxs("header", { className: "grid gap-3 border-b border-white/5 pb-4 xl:grid-cols-[auto_1fr_auto]", children: [
        onBack && jsxs("button", {
          type: "button",
          onClick: onBack,
          className: "btn btn-ghost btn-sm gap-2 self-start",
          "aria-label": "رجوع للمشاريع",
          children: [jsx(ArrowRight, { className: "h-4 w-4" }), "رجوع"]
        }),
        jsxs("div", { className: "min-w-0 space-y-2", children: [
          jsx("input", {
            value: project.name,
            onChange: (e) => onPatch({ name: e.target.value }),
            placeholder: "اسم المشروع",
            "aria-label": "اسم المشروع",
            className: "w-full bg-transparent text-xl font-bold text-white outline-none placeholder:text-gray-600"
          }),
          jsx("textarea", {
            value: project.description,
            onChange: (e) => onPatch({ description: e.target.value }),
            placeholder: "وصف موجز للمشروع (اختياري)",
            "aria-label": "وصف المشروع",
            className: "textarea textarea-bordered min-h-16 w-full"
          })
        ] }),
        jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 xl:min-w-[28rem]", children: [
          jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [jsx("p", { className: "text-gray-500", children: "المدة" }), jsx("p", { className: "mt-1 font-semibold text-white", children: formatClock(total) })] }),
          jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [jsx("p", { className: "text-gray-500", children: "قصاصات" }), jsx("p", { className: "mt-1 font-semibold text-white", children: `${formatNumber(validCuts.length)} / ${formatNumber(ordered.length)}` })] }),
          jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [jsx("p", { className: "text-gray-500", children: "معتمدة" }), jsx("p", { className: "mt-1 font-semibold text-white", children: formatNumber(approvedCount) })] }),
          jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [jsx("p", { className: "text-gray-500", children: "تنبيهات" }), jsx("p", { className: mediaIssues ? "mt-1 font-semibold text-amber-200" : "mt-1 font-semibold text-emerald-200", children: formatNumber(mediaIssues) })] })
        ] })
      ] }),

      jsxs("div", { className: "grid gap-4 2xl:grid-cols-[21rem_minmax(0,1fr)_22rem]", children: [
        jsxs("div", { className: "min-w-0 space-y-4", children: [
          jsx(MaterialImportPanel, {
            contentTypes,
            onImport: async (draft) => {
              const created = await onImportMaterial?.(project.id, draft);
              if (created?.id) setSelectedSourceId(created.id);
              return created;
            }
          }),
          jsx(SourceBin, {
            items,
            query: sourceQuery,
            onQuery: setSourceQuery,
            selectedId: selectedSourceId,
            onSelect: setSelectedSourceId,
            projectItemIds: project.itemIds || []
          }),
          jsx(MaterialInspector, {
            item: selectedSource,
            contentTypes,
            projectItemIds: project.itemIds || [],
            onUpdate: onUpdateMaterial,
            onAttach: (itemId) => onAttachMaterial?.(project.id, itemId)
          })
        ] }),
        jsxs("div", { className: "min-w-0 space-y-4", children: [
          jsx(PreviewComposer, {
            item: selectedSource,
            markIn,
            markOut,
            onSetMarkIn: setMarkIn,
            onSetMarkOut: setMarkOut,
            onAddCut,
            onTimeChange: setCurrentTime
          }),
          jsxs("section", { className: "rounded-2xl border border-white/10 bg-gray-950/35 p-3", children: [
            jsxs("div", { className: "mb-3 flex flex-wrap items-center justify-between gap-2", children: [
              jsxs("h3", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(ListVideo, { className: "h-4 w-4 va-accent-text" }), "الخط الزمني الاحترافي"] }),
              jsxs("div", { className: "flex items-center gap-2", children: [
                jsx("span", { className: "rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400", children: `${formatNumber(ordered.length)} قصاصة · ${formatClock(total)}` }),
                jsx("select", { value: timelineZoom, onChange: (e) => setTimelineZoom(Number(e.target.value)), className: "select select-bordered select-sm", "aria-label": "تكبير الخط الزمني", children: TIMELINE_ZOOM.map((zoom) => jsx("option", { value: zoom.value, children: zoom.label }, zoom.value)) })
              ] })
            ] }),
            ordered.length ? jsx(TimelineTrack, {
              clips: ordered,
              selectedId: selectedClipId,
              onSelect: setSelectedClipId,
              onMoveClip: onReorderClips,
              pxPerSecond: timelineZoom
            }) : jsx("p", { className: "rounded-xl border border-dashed border-white/10 bg-gray-950/30 p-4 text-center text-sm text-gray-500", children: "الخطّ الزمني فارغ — اختر مصدرًا وحدد In/Out ثم أضف القصاصة." }),
            ordered.length ? jsx("div", { className: "mt-3 space-y-2", children: ordered.map((cut, i) => jsx(TimelineRow, {
              cut, index: i, total: ordered.length, itemsById, onMove: onMoveCut, onRemove: onRemoveCut
            }, cut.id)) }) : null
          ] })
        ] }),
        jsxs("div", { className: "space-y-4", children: [
          jsx(ClipInspector, {
            clip: selectedClip,
            item: selectedClipItem,
            comments: selectedClipComments,
            currentTime,
            onUpdate: updateClip,
            onUseCurrent: useCurrentOnClip,
            onSplit: splitSelectedClip,
            onDuplicate: duplicateSelectedClip,
            onAddComment,
            onRemove: () => selectedClip && onRemoveCut(selectedClip.id)
          }),
          jsx(TimelineSettingsPanel, {
            settings: project.timelineSettings,
            onChange: (timelineSettings) => onPatch({ timelineSettings })
          }),
          jsx(MarkerPanel, {
            markers: project.markers || [],
            currentTime,
            onAddMarker
          }),
          jsx(ExportCenter, {
            canExport: mp4Enabled,
            exportMode: mp4Mode,
            serverFfmpeg,
            hasValidCuts: validCuts.length > 0,
            exporting,
            onExport,
            onDownloadPackage,
            exportEvents
          })
        ] })
      ] }),

      jsxs("section", { className: "rounded-2xl border border-white/10 bg-gray-950/35 p-4", children: [
        jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
          jsxs("div", { children: [
            jsxs("p", { className: "flex items-center gap-2 text-sm font-semibold text-white", children: [jsx(ClipboardList, { className: "h-4 w-4 va-accent-text" }), "مهام الإنتاج في قسم مستقل"] }),
            jsx("p", { className: "mt-1 text-sm text-gray-500", children: "تم نقل إضافة المهام ولوحة الحالات إلى صفحة مهام الإنتاج حتى تبقى محطة المونتاج مخصصة للقص والتايملاين والتصدير." })
          ] }),
          jsxs("button", {
            type: "button",
            onClick: onOpenProductionTasks,
            className: "btn btn-ghost gap-2",
            children: [jsx(ArrowRight, { className: "h-4 w-4" }), "افتح مهام الإنتاج من القائمة"]
          })
        ] })
      ] })
    ]
  });
}

// ── create modal ─────────────────────────────────────────────────────────────
function ProjectForm({ onCancel, onSave }) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const nameId = React.useId();
  const descId = React.useId();
  const nameRef = React.useRef(null);

  const submit = async (keepOpen) => {
    const clean = name.trim();
    if (!clean) return;
    const ok = await onSave({ name: clean, description: description.trim() }, { keepOpen });
    if (ok && keepOpen) {
      setName("");
      setDescription("");
      window.requestAnimationFrame(() => nameRef.current?.focus());
    }
  };

  return jsx(EntityFormModal, {
    title: "مشروع مونتاج جديد",
    icon: jsx(Clapperboard, { className: "h-4 w-4" }),
    onCancel,
    onSubmit: () => submit(false),
    onSubmitAndNew: () => submit(true),
    canSubmit: Boolean(name.trim()),
    submitLabel: "إنشاء المشروع",
    isEditing: false,
    children: jsxs("div", {
      className: "space-y-3",
      children: [
        jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("label", { htmlFor: nameId, className: "block", children: "اسم المشروع" }),
          jsx("input", { id: nameId, ref: nameRef, "data-autofocus": true, value: name, onChange: (e) => setName(e.target.value), placeholder: "مثال: تقرير القدس", className: "input input-bordered w-full" })
        ] }),
        jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("label", { htmlFor: descId, className: "block", children: "الوصف (اختياري)" }),
          jsx("textarea", { id: descId, value: description, onChange: (e) => setDescription(e.target.value), placeholder: "وصف موجز للمشروع", className: "textarea textarea-bordered w-full" })
        ] })
      ]
    })
  });
}

export function ProjectsPage() {
  const {
    projects = [],
    videoItems = [],
    contentTypes = [],
    settings = {},
    connectionStatus,
    addProject,
    updateProject,
    deleteProject,
    addVideoItem,
    updateVideoItem,
    setCurrentPage,
    showToast,
    showNotification
  } = useAppStore();

  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState(projects[0]?.id || null);
  // §19.9 — opening a project gives it a full dedicated view instead of a
  // cramped side aside. `openedId` holds the project shown full-width; null
  // means the projects list is visible.
  const [openedId, setOpenedId] = React.useState(null);
  const [exporting, setExporting] = React.useState(false);
  const [exportEvents, setExportEvents] = React.useState([]);
  const [showForm, setShowForm] = React.useState(false);

  const activeItems = React.useMemo(() => videoItems.filter((i) => !i.isDeleted), [videoItems]);
  const itemsById = React.useMemo(() => new Map(activeItems.map((i) => [i.id, i])), [activeItems]);
  const filtered = React.useMemo(() => getFilteredProjects(projects, query), [projects, query]);
  const selected = projects.find((p) => p.id === selectedId) || filtered[0] || null;
  const openedProject = openedId ? projects.find((p) => p.id === openedId) || null : null;
  const summary = React.useMemo(() => getProjectSummary(projects), [projects]);
  const productionSummary = React.useMemo(() => buildProductionBoardSummary(projects, activeItems), [projects, activeItems]);
  const totalTasks = React.useMemo(() => projects.filter((project) => project.status !== "archived").reduce((sum, project) => sum + (project.tasks?.length || 0), 0), [projects]);

  const cloud = React.useMemo(() => resolveBackendChoice(), []);
  const wasmMp4Enabled = hasFfmpegWasmSupport();
  const serverFfmpeg = connectionStatus?.health?.export?.mp4?.serverFfmpeg || null;
  const mp4Enabled = canExportMp4({ backend: cloud.backend, token: getCloudToken(), wasmAvailable: wasmMp4Enabled });
  const mp4Mode = cloud.backend !== "local" && getCloudToken() ? "server" : wasmMp4Enabled ? "wasm" : "unavailable";

  React.useEffect(() => {
    if (selectedId && projects.some((p) => p.id === selectedId)) return;
    setSelectedId(filtered[0]?.id || null);
  }, [filtered, projects, selectedId]);

  // If the opened project disappears (deleted), fall back to the list view.
  React.useEffect(() => {
    if (openedId && !projects.some((p) => p.id === openedId)) setOpenedId(null);
  }, [openedId, projects]);

  const openProject = (project) => {
    setSelectedId(project.id);
    setOpenedId(project.id);
  };

  const closeProject = () => setOpenedId(null);

  const openCreate = () => setShowForm(true);

  const saveProject = async (draft, opts = {}) => {
    try {
      const created = createProjectValue({ name: draft.name || "مشروع جديد", description: draft.description || "" });
      await addProject?.(created);
      setSelectedId(created.id);
      if (!opts.keepOpen) {
        setShowForm(false);
        setOpenedId(created.id);
      }
      return true;
    } catch (error) {
      reportError(showNotification, error, { context: "إنشاء مشروع", recovery: { run: () => saveProject(draft, opts) } });
      return false;
    }
  };

  const persist = async (next) => {
    try {
      await updateProject?.(next);
    } catch (error) {
      reportError(showNotification, error, { context: "حفظ المشروع" });
    }
  };

  const patchProject = (patch) => {
    if (!selected) return;
    persist({ ...selected, ...patch });
  };

  const addCut = (cutPartial) => {
    if (!selected) return;
    persist(addRoughCut(selected, cutPartial));
    showToast?.("أُضيفت القصاصة إلى الخطّ الزمني", "success");
  };

  const moveCut = (cutId, toIndex) => {
    if (!selected) return;
    persist(reorderRoughCut(selected, cutId, toIndex));
  };

  const removeCut = (cutId) => {
    if (!selected) return;
    persist(removeRoughCut(selected, cutId));
  };

  const splitCut = (cutId, atSec) => {
    if (!selected) return;
    const next = splitRoughCut(selected, cutId, atSec);
    if (next === selected) {
      showToast?.("لا يمكن قص هذه القصاصة عند هذا الموضع", "warning");
      return;
    }
    persist(next);
    showToast?.("تم قص القصاصة إلى جزأين", "success");
  };

  const duplicateCut = (cutId) => {
    if (!selected) return;
    persist(duplicateRoughCut(selected, cutId));
    showToast?.("تم نسخ القصاصة داخل الخط الزمني", "success");
  };

  const addMarker = (markerPartial) => {
    if (!selected) return;
    persist(addProjectMarker(selected, markerPartial));
    showToast?.("أُضيفت marker إلى الخط الزمني", "success");
  };

  const addComment = (commentPartial) => {
    if (!selected) return;
    persist(addTemporalComment(selected, commentPartial));
    showNotification?.("أُضيف تعليق زمني للمراجعة.", {
      type: "success",
      category: "task",
      title: "تعليق مونتاج",
      targetLabel: selected.name || "مشروع"
    });
  };

  const attachMaterialToProject = async (projectId, itemId) => {
    const target = projects.find((project) => project.id === projectId);
    if (!target || !itemId || (target.itemIds || []).includes(itemId)) return target;
    const next = {
      ...target,
      itemIds: [...(target.itemIds || []), itemId],
      updatedAt: new Date().toISOString()
    };
    try {
      await updateProject?.(next);
      showToast?.("تم ربط المادة بالمشروع", "success");
      return next;
    } catch (error) {
      reportError(showNotification, error, { context: "ربط مادة بالمشروع" });
      return null;
    }
  };

  const importMaterial = async (projectId, draft = {}) => {
    const target = projects.find((project) => project.id === projectId);
    if (!target) return null;
    const firstType = contentTypes.find((type) => type.status !== "archived") || contentTypes[0];
    try {
      const created = await addVideoItem?.({
        title: draft.title || "مادة مونتاج",
        type: draft.type || firstType?.id || "",
        subtype: draft.subtype || "",
        path: draft.path || "",
        thumbnail: draft.thumbnail || draft.media?.thumbnailKey || "",
        notes: draft.notes || "",
        tags: draft.tags || [],
        metadata: {
          media: draft.media || {},
          importedFrom: "montageWorkstation",
          importedAt: new Date().toISOString(),
          sourceKind: draft.sourceKind || "path",
          projectId
        }
      });
      if (created?.id) {
        await attachMaterialToProject(projectId, created.id);
        showNotification?.("تم استيراد المادة وربطها بالمشروع.", {
          type: "success",
          category: "archive",
          title: "استيراد مادة مونتاج",
          targetLabel: created.title || target.name
        });
      }
      return created;
    } catch (error) {
      reportError(showNotification, error, { context: "استيراد مادة للمونتاج", recovery: { run: () => importMaterial(projectId, draft) } });
      return null;
    }
  };

  const updateMaterial = async (itemId, patch = {}) => {
    const current = itemsById.get(itemId);
    if (!current) return null;
    const metadata = patch.metadata
      ? { ...(current.metadata || {}), ...patch.metadata }
      : current.metadata;
    const next = { ...current, ...patch, metadata };
    try {
      const updated = await updateVideoItem?.(next);
      showToast?.("تم حفظ إعدادات المادة", "success");
      return updated;
    } catch (error) {
      reportError(showNotification, error, { context: "تحديث إعدادات المادة" });
      return null;
    }
  };

  const updateCut = (cutId, patch) => {
    if (!selected) return;
    const roughCuts = (selected.roughCuts || []).map((cut) => {
      if (cut.id !== cutId) return cut;
      const next = { ...cut, ...patch };
      if (Number(next.outSec) < Number(next.inSec)) {
        if (Object.prototype.hasOwnProperty.call(patch, "inSec")) next.inSec = next.outSec;
        else next.outSec = next.inSec;
      }
      return next;
    });
    persist({ ...selected, roughCuts, updatedAt: new Date().toISOString() });
  };

  // Visual timeline drag-reorder: `nextClips` already carries re-sequenced order.
  const reorderClipsVisual = (nextClips) => {
    if (!selected || !Array.isArray(nextClips)) return;
    persist({ ...selected, roughCuts: nextClips, updatedAt: new Date().toISOString() });
  };

  const removeProject = async (project) => {
    const itemCount = activeItems.filter((item) => item.project === project.id).length;
    const confirmed = await showConfirm({
      level: 2,
      title: "حذف مشروع",
      message: itemCount > 0
        ? `سيتم حذف المشروع "${project.name}" والبيانات المرتبطة به (${itemCount} عنصر مرتبط).\nلن تُحذف ملفات الفيديو نفسها.`
        : `سيتم حذف المشروع "${project.name}" وبياناته. لن تُحذف ملفات الفيديو نفسها.`,
      confirmPhrase: project.name
    });
    if (!confirmed) return;
    try {
      await deleteProject?.(project.id);
      if (selectedId === project.id) setSelectedId(null);
    } catch (error) {
      reportError(showNotification, error, { context: "حذف المشروع", recovery: { run: () => removeProject(project) } });
    }
  };

  const runExport = async (kind) => {
    if (!selected) return;
    const timeline = buildProjectTimeline(selected, itemsById);
    if (!timeline.clips.length) {
      showToast?.("لا توجد قصاصات صالحة للتصدير", "warning");
      return;
    }
    try {
      if (kind === "json") {
        downloadTimelineJson(timeline, selected.name);
        showNotification?.("تم تنزيل ملف الخطّ الزمني (JSON).", { type: "success", category: "export", title: "اكتمل التصدير", targetLabel: selected.name });
        setExportEvents((events) => [{ id: `${Date.now()}-json`, ok: true, label: "JSON timeline", time: formatDateTime(new Date().toISOString()) }, ...events]);
      } else if (kind === "edl") {
        downloadEdl(buildEdl(selected, itemsById), selected.name);
        showNotification?.("تم تنزيل ملف EDL.", { type: "success", category: "export", title: "اكتمل التصدير", targetLabel: selected.name });
        setExportEvents((events) => [{ id: `${Date.now()}-edl`, ok: true, label: "EDL CMX3600", time: formatDateTime(new Date().toISOString()) }, ...events]);
      } else if (kind === "mp4") {
        setExporting(true);
        await exportProjectMp4({
          timeline,
          name: selected.name,
          baseUrl: getBackendUrl(),
          getToken: getCloudToken,
          allowWasmFallback: true
        });
        showNotification?.("تم تصدير MP4 وتنزيله.", { type: "success", category: "export", title: "اكتمل تصدير MP4", targetLabel: selected.name });
        setExportEvents((events) => [{ id: `${Date.now()}-mp4`, ok: true, label: "MP4 render", time: formatDateTime(new Date().toISOString()) }, ...events]);
      }
    } catch (error) {
      if (error instanceof CloudExportError) {
        showToast?.(error.message, "error");
        setExportEvents((events) => [{ id: `${Date.now()}-${kind}-error`, ok: false, label: `فشل ${kind.toUpperCase()}`, time: formatDateTime(new Date().toISOString()) }, ...events]);
      } else {
        reportError(showNotification, error, { context: `تصدير ${kind.toUpperCase()}` });
        setExportEvents((events) => [{ id: `${Date.now()}-${kind}-error`, ok: false, label: `فشل ${kind.toUpperCase()}`, time: formatDateTime(new Date().toISOString()) }, ...events]);
      }
    } finally {
      if (kind === "mp4") setExporting(false);
    }
  };

  const downloadDeliveryPackage = () => {
    if (!selected) return;
    const manifest = buildProjectDeliveryPackage(selected, itemsById);
    const ok = downloadJsonObject(manifest, `${safeFileName(selected.name || "project")}.delivery.json`);
    if (ok) {
      showNotification?.("تم تنزيل حزمة التسليم metadata.", { type: "success", category: "export", title: "حزمة التسليم", targetLabel: selected.name });
      setExportEvents((events) => [{ id: `${Date.now()}-delivery`, ok: true, label: "Delivery package", time: formatDateTime(new Date().toISOString()) }, ...events]);
    } else {
      showToast?.("تعذر تنزيل حزمة التسليم في هذه البيئة.", "error");
      setExportEvents((events) => [{ id: `${Date.now()}-delivery-error`, ok: false, label: "فشل حزمة التسليم", time: formatDateTime(new Date().toISOString()) }, ...events]);
    }
  };

  return jsxs(motion.div, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
    className: "va-page-shell space-y-6 p-4 sm:p-6",
    dir: "rtl",
    children: [
      jsx(PageHero, {
        icon: jsx(Clapperboard, { className: "h-6 w-6 va-accent-text" }),
        title: "مشاريع المونتاج",
        description: "اجمع لقطات الأرشيف في خطّ زمني مرتّب بنقاط قص (in/out)، ثم صدّر JSON أو EDL لبرامج المونتاج أو MP4 جاهزًا من الخادم.",
        actions: jsxs("button", { type: "button", onClick: openCreate, className: "btn btn-primary gap-2", children: [jsx(Plus, { className: "h-4 w-4" }), "مشروع جديد"] })
      }),

      showForm && jsx(ProjectForm, {
        onCancel: () => setShowForm(false),
        onSave: saveProject
      }),

      projects.length > 0 && jsx(ProductionBoard, { summary: productionSummary }),

      projects.length > 0 && jsx("section", {
        className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-5",
        children: [
          ["كل المشاريع", formatNumber(summary.total, settings.numberSystem), Clapperboard],
          ["مؤرشفة", formatNumber(summary.archived, settings.numberSystem), ArchiveIcon],
          ["إجمالي القصاصات", formatNumber(summary.totalRoughCuts, settings.numberSystem), Scissors],
          ["مهام مفتوحة", formatNumber(totalTasks, settings.numberSystem), ClipboardList],
          ["إجمالي المدّة", formatClock(summary.totalSeconds), Film]
        ].map(([label, value, Icon]) => jsxs("div", { className: "va-metric-card rounded-2xl va-surface-muted border p-4 text-right", children: [
          jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            jsx("span", { className: "text-sm text-gray-500", children: label }),
            jsx(Icon, { className: "h-5 w-5 va-accent-text" })
          ] }),
          jsx("p", { className: "mt-2 text-2xl font-bold text-white", children: value })
        ] }, label))
      }),

      projects.length === 0 ? jsx("div", {
        className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35",
        children: jsx(EmptyState, {
          icon: jsx(Clapperboard, { className: "h-16 w-16" }),
          title: "ابدأ مشروع مونتاج",
          description: "أنشئ مشروعًا لتجميع لقطات الأرشيف في خطّ زمني قابل للتصدير (EDL/JSON/MP4) مع لوحة مهام للفريق.",
          actionLabel: "إنشاء مشروع",
          onAction: openCreate,
          hintItems: ["نقاط قص in/out", "لوحة مهام", "تصدير EDL/JSON/MP4"]
        })
      }) : openedProject ? jsx(ProjectEditor, {
        project: openedProject,
        items: activeItems,
        itemsById,
        onBack: closeProject,
        onPatch: patchProject,
        onAddCut: addCut,
        onMoveCut: moveCut,
        onRemoveCut: removeCut,
        onUpdateCut: updateCut,
        onSplitCut: splitCut,
        onDuplicateCut: duplicateCut,
        onReorderClips: reorderClipsVisual,
        onAddMarker: addMarker,
        onAddComment: addComment,
        onImportMaterial: importMaterial,
        onUpdateMaterial: updateMaterial,
        onAttachMaterial: attachMaterialToProject,
        onExport: runExport,
        onDownloadPackage: downloadDeliveryPackage,
        mp4Enabled,
        mp4Mode,
        serverFfmpeg,
        exporting,
        exportEvents,
        contentTypes,
        onOpenProductionTasks: () => setCurrentPage?.("production-tasks")
      }) : jsxs("section", { className: "space-y-4", children: [
        jsxs("label", { className: "va-filter-surface relative block rounded-2xl va-surface-muted border p-3", children: [
          jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
          jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "بحث في المشاريع...", className: "input input-bordered w-full py-2 pl-3 pr-10 placeholder:text-gray-600" })
        ] }),
        filtered.length ? jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", children: filtered.map((project, index) => jsx(ProjectCard, {
          project, index,
          active: selected?.id === project.id,
          onOpen: () => openProject(project),
          onDelete: () => removeProject(project)
        }, project.id)) }) : jsx("div", { className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35", children: jsx(EmptyState, {
          icon: jsx(Clapperboard, { className: "h-16 w-16" }),
          title: "لا توجد مشاريع مطابقة",
          description: "امسح البحث أو استخدم كلمة أبسط.",
          actionLabel: "مسح البحث",
          onAction: () => setQuery(""),
          actionIcon: RefreshCw
        }) })
      ] })
    ]
  });
}

ProjectsPage.pageId = "projects";
ProjectsPage.migrationStatus = "native";

export default ProjectsPage;
