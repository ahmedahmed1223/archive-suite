import {
  useAppStore
} from "../stores/index.js";
import {
  Clapperboard,
  Download,
  FileJson,
  Film,
  ListVideo,
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
  Link2,
  RefreshCw,
  UserRound
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
  addRoughCut,
  addProjectTask,
  buildEdl,
  buildProjectTimeline,
  createProjectValue,
  getFilteredProjects,
  getOrderedRoughCuts,
  getProjectDuration,
  getProjectSummary,
  getProjectTasksByStatus,
  isValidRoughCut,
  moveProjectTask,
  PROJECT_TASK_STATUSES,
  removeRoughCut,
  removeProjectTask,
  reorderRoughCut,
  roughCutDuration,
  secondsToTimecode
} from "../features/projects/viewModel.js";
import {
  CloudExportError,
  canExportMp4,
  downloadEdl,
  downloadTimelineJson,
  exportProjectMp4
} from "../features/projects/exportClient.js";
import { getBackendUrl, resolveBackendChoice } from "../bootstrap/backendChoice.js";
import { getCloudToken } from "../bootstrap/cloudSession.js";
import { TimelineTrack } from "../components/montage/TimelineTrack.jsx";

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

const KANBAN_META = {
  todo: { label: "للعمل", tone: "border-sky-500/20 bg-sky-500/10 text-sky-100" },
  doing: { label: "قيد التنفيذ", tone: "border-amber-500/20 bg-amber-500/10 text-amber-100" },
  review: { label: "مراجعة", tone: "border-violet-500/20 bg-violet-500/10 text-violet-100" },
  done: { label: "منجز", tone: "va-accent-border va-accent-bg-soft va-accent-text-on-soft" }
};

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

function TaskBuilder({ items, users, onAdd }) {
  const [title, setTitle] = React.useState("");
  const [status, setStatus] = React.useState("todo");
  const [itemId, setItemId] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const titleId = React.useId();
  const itemIdField = React.useId();
  const assigneeIdField = React.useId();

  const submit = () => {
    const clean = title.trim();
    if (!clean) return;
    onAdd({ title: clean, status, itemId, assigneeId });
    setTitle("");
  };

  return jsxs("div", {
    className: "va-surface-muted rounded-xl border p-3",
    children: [
      jsxs("p", { className: "mb-2 flex items-center gap-2 text-sm font-semibold text-gray-300", children: [
        jsx(ClipboardList, { className: "h-4 w-4 va-accent-text" }), "إضافة مهمة"
      ] }),
      jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [
        jsxs("label", { className: "space-y-1 text-sm text-gray-300 sm:col-span-2", htmlFor: titleId, children: [
          jsx("span", { children: "عنوان المهمة" }),
          jsx("input", { id: titleId, value: title, onChange: (e) => setTitle(e.target.value), placeholder: "مثال: مراجعة لقطة الافتتاح", className: "input input-bordered w-full" })
        ] }),
        jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("span", { children: "الحالة" }),
          jsx("select", { value: status, onChange: (e) => setStatus(e.target.value), className: "select select-bordered w-full", children: PROJECT_TASK_STATUSES.map((key) => jsx("option", { value: key, children: KANBAN_META[key].label }, key)) })
        ] }),
        jsxs("label", { className: "space-y-1 text-sm text-gray-300", htmlFor: itemIdField, children: [
          jsx("span", { children: "مادة مرتبطة" }),
          jsxs("select", { id: itemIdField, value: itemId, onChange: (e) => setItemId(e.target.value), className: "select select-bordered w-full", children: [
            jsx("option", { value: "", children: "بدون ربط" }),
            ...items.slice(0, 500).map((item) => jsx("option", { value: item.id, children: itemLabel(item) }, item.id))
          ] })
        ] }),
        jsxs("label", { className: "space-y-1 text-sm text-gray-300 sm:col-span-2", htmlFor: assigneeIdField, children: [
          jsx("span", { children: "المسؤول" }),
          jsxs("select", { id: assigneeIdField, value: assigneeId, onChange: (e) => setAssigneeId(e.target.value), className: "select select-bordered w-full", children: [
            jsx("option", { value: "", children: "غير مسندة" }),
            ...users.filter((user) => user.isActive !== false).map((user) => jsx("option", { value: user.id, children: user.displayName || user.username || user.id }, user.id))
          ] })
        ] })
      ] }),
      jsx("div", { className: "mt-2 flex justify-end", children: jsxs("button", {
        type: "button", onClick: submit, disabled: !title.trim(),
        className: "btn btn-primary gap-2",
        children: [jsx(Plus, { className: "h-4 w-4" }), "إضافة للوحة"]
      }) })
    ]
  });
}

function KanbanBoard({ project, itemsById, usersById, onMoveTask, onRemoveTask }) {
  const grouped = getProjectTasksByStatus(project);
  return jsx("div", {
    className: "grid gap-3 xl:grid-cols-4",
    children: PROJECT_TASK_STATUSES.map((status) => {
      const meta = KANBAN_META[status];
      const tasks = grouped[status] || [];
      return jsxs("section", {
        className: "min-w-0 rounded-xl border border-white/10 bg-gray-950/25 p-3",
        children: [
          jsxs("div", { className: "mb-3 flex items-center justify-between gap-2", children: [
            jsx("h3", { className: `rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`, children: meta.label }),
            jsx("span", { className: "text-xs text-gray-600", children: formatNumber(tasks.length) })
          ] }),
          tasks.length ? jsx("div", { className: "space-y-2", children: tasks.map((task) => {
            const linked = task.itemId ? itemsById.get(task.itemId) : null;
            const assignee = task.assigneeId ? usersById.get(task.assigneeId) : null;
            return jsxs("article", { className: "rounded-xl border border-white/10 bg-gray-900/45 p-3", children: [
              jsxs("div", { className: "flex items-start justify-between gap-2", children: [
                jsxs("div", { className: "min-w-0", children: [
                  jsx("p", { className: "text-sm font-semibold leading-6 text-white", children: task.title || "مهمة بدون عنوان" }),
                  linked && jsxs("p", { className: "mt-1 flex items-center gap-1.5 truncate text-xs text-gray-500", children: [jsx(Link2, { className: "h-3.5 w-3.5" }), itemLabel(linked)] }),
                  assignee && jsxs("p", { className: "mt-1 flex items-center gap-1.5 truncate text-xs text-gray-500", children: [jsx(UserRound, { className: "h-3.5 w-3.5" }), assignee.displayName || assignee.username || assignee.id] })
                ] }),
                jsx("button", { type: "button", onClick: () => onRemoveTask(task.id), "aria-label": "حذف المهمة", className: "shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-300", children: jsx(Trash2, { className: "h-4 w-4" }) })
              ] }),
              jsx("select", { value: task.status, onChange: (e) => onMoveTask(task.id, e.target.value), className: "select select-bordered w-full mt-3", children: PROJECT_TASK_STATUSES.map((key) => jsx("option", { value: key, children: KANBAN_META[key].label }, key)) })
            ] }, task.id);
          }) }) : jsx("p", { className: "rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-gray-600", children: "فارغ" })
        ]
      }, status);
    })
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
            project.description && jsx("p", { className: "mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500", children: project.description }),
            jsxs("span", { className: "mt-2.5 inline-flex items-center gap-1 rounded-full border va-accent-border va-accent-bg-soft px-2 py-0.5 text-xs font-medium va-accent-text-on-soft", children: [
              jsx(ListVideo, { className: "h-3 w-3 opacity-70" }), `${formatNumber(cuts)} قصاصة · ${formatClock(getProjectDuration(project))}`
            ] })
          ] })
        ] }),
        jsx("div", { className: "flex shrink-0 gap-1", onClick: (e) => e.stopPropagation(), children: jsx("button", { type: "button", onClick: onDelete, className: "rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-300", "aria-label": `حذف ${project.name}`, children: jsx(Trash2, { className: "h-4 w-4" }) }) })
      ] }),
      project.updatedAt && jsx("p", { className: "mt-3 text-xs text-gray-700", children: `آخر تحديث: ${formatDateTime(project.updatedAt)}` })
    ]
  }, project.id);
}

// ── editor panel ─────────────────────────────────────────────────────────────
function ProjectEditor({
  project, items, itemsById, users, usersById, onPatch,
  onAddCut, onMoveCut, onRemoveCut, onReorderClips, onAddTask, onMoveTask, onRemoveTask,
  onExport, mp4Enabled, exporting, onBack
}) {
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

  return jsxs("section", {
    className: "va-preview-panel space-y-4 rounded-2xl va-surface-muted border p-4 text-right",
    dir: "rtl",
    children: [
      onBack && jsxs("button", {
        type: "button",
        onClick: onBack,
        className: "btn btn-ghost btn-sm gap-2 self-start",
        "aria-label": "رجوع للمشاريع",
        children: [jsx(ArrowRight, { className: "h-4 w-4" }), "رجوع للمشاريع"]
      }),
      jsxs("div", { className: "space-y-2", children: [
        jsx("input", {
          value: project.name,
          onChange: (e) => onPatch({ name: e.target.value }),
          placeholder: "اسم المشروع",
          "aria-label": "اسم المشروع",
          className: "w-full bg-transparent text-lg font-bold text-white outline-none placeholder:text-gray-600"
        }),
        jsx("textarea", {
          value: project.description,
          onChange: (e) => onPatch({ description: e.target.value }),
          placeholder: "وصف موجز للمشروع (اختياري)",
          "aria-label": "وصف المشروع",
          className: "textarea textarea-bordered w-full"
        })
      ] }),

      jsx(RoughCutBuilder, { items, onAdd: onAddCut }),

      jsxs("div", { className: "space-y-3", children: [
        jsx(TaskBuilder, { items, users, onAdd: onAddTask }),
        jsxs("div", { children: [
          jsxs("div", { className: "mb-2 flex items-center justify-between", children: [
            jsxs("p", { className: "flex items-center gap-2 text-sm font-semibold text-gray-300", children: [jsx(CheckCircle2, { className: "h-4 w-4 va-accent-text" }), "لوحة المهام"] }),
            jsx("span", { className: "rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400", children: `${formatNumber(project.tasks?.length || 0)} مهمة` })
          ] }),
          jsx(KanbanBoard, { project, itemsById, usersById, onMoveTask, onRemoveTask })
        ] })
      ] }),

      jsxs("div", { children: [
        jsxs("div", { className: "mb-2 flex items-center justify-between", children: [
          jsxs("p", { className: "flex items-center gap-2 text-sm font-semibold text-gray-300", children: [jsx(ListVideo, { className: "h-4 w-4 va-accent-text" }), "الخطّ الزمني"] }),
          jsx("span", { className: "rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400", children: `${formatNumber(ordered.length)} قصاصة · ${formatClock(total)}` })
        ] }),
        ordered.length ? jsx("div", { className: "mb-3", children: jsx(TimelineTrack, {
          clips: ordered,
          selectedId: null,
          onMoveClip: onReorderClips
        }) }) : null,
        ordered.length ? jsx("div", { className: "space-y-2", children: ordered.map((cut, i) => jsx(TimelineRow, {
          cut, index: i, total: ordered.length, itemsById, onMove: onMoveCut, onRemove: onRemoveCut
        }, cut.id)) }) : jsx("p", { className: "rounded-xl border border-dashed border-white/10 bg-gray-950/30 p-4 text-center text-sm text-gray-500", children: "الخطّ الزمني فارغ — أضف قصاصة من الأعلى." })
      ] }),

      jsxs("div", { className: "flex flex-wrap items-center gap-2 border-t border-white/5 pt-3", children: [
        jsxs("button", { type: "button", onClick: () => onExport("json"), disabled: !ordered.some(isValidRoughCut), className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-40", children: [jsx(FileJson, { className: "h-4 w-4" }), "تصدير JSON"] }),
        jsxs("button", { type: "button", onClick: () => onExport("edl"), disabled: !ordered.some(isValidRoughCut), className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-40", children: [jsx(Download, { className: "h-4 w-4" }), "تصدير EDL"] }),
        jsxs("button", {
          type: "button", onClick: () => onExport("mp4"),
          disabled: !mp4Enabled || exporting || !ordered.some(isValidRoughCut),
          title: mp4Enabled ? "عرض MP4 على الخادم عبر ffmpeg" : "تصدير MP4 يتطلّب تسجيل الدخول إلى خادم سحابي",
          className: "btn btn-primary gap-2",
          children: [jsx(Film, { className: "h-4 w-4" }), exporting ? "جارٍ التصدير…" : "تصدير MP4"]
        })
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
    users = [],
    settings = {},
    addProject,
    updateProject,
    deleteProject,
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
  const [showForm, setShowForm] = React.useState(false);

  const activeItems = React.useMemo(() => videoItems.filter((i) => !i.isDeleted), [videoItems]);
  const itemsById = React.useMemo(() => new Map(activeItems.map((i) => [i.id, i])), [activeItems]);
  const usersById = React.useMemo(() => new Map((users || []).map((user) => [user.id, user])), [users]);
  const filtered = React.useMemo(() => getFilteredProjects(projects, query), [projects, query]);
  const selected = projects.find((p) => p.id === selectedId) || filtered[0] || null;
  const openedProject = openedId ? projects.find((p) => p.id === openedId) || null : null;
  const summary = React.useMemo(() => getProjectSummary(projects), [projects]);
  const totalTasks = React.useMemo(() => projects.filter((project) => project.status !== "archived").reduce((sum, project) => sum + (project.tasks?.length || 0), 0), [projects]);

  const cloud = React.useMemo(() => resolveBackendChoice(), []);
  const mp4Enabled = canExportMp4({ backend: cloud.backend, token: getCloudToken() });

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

  // Visual timeline drag-reorder: `nextClips` already carries re-sequenced order.
  const reorderClipsVisual = (nextClips) => {
    if (!selected || !Array.isArray(nextClips)) return;
    persist({ ...selected, roughCuts: nextClips, updatedAt: new Date().toISOString() });
  };

  const addTask = (taskPartial) => {
    if (!selected) return;
    persist(addProjectTask(selected, taskPartial));
    const assignee = usersById.get(taskPartial.assigneeId);
    showNotification?.(assignee ? `أُضيفت مهمة مسندة إلى ${assignee.displayName || assignee.username || "مستخدم"}.` : "أُضيفت مهمة إلى لوحة المشروع.", {
      type: "success",
      category: "task",
      title: "مهمة مشروع جديدة",
      targetLabel: selected.name || "مشروع",
      action: { label: "فتح المشروع", run: () => openProject(selected) }
    });
  };

  const moveTask = (taskId, status) => {
    if (!selected) return;
    persist(moveProjectTask(selected, taskId, status));
  };

  const removeTask = (taskId) => {
    if (!selected) return;
    persist(removeProjectTask(selected, taskId));
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
      } else if (kind === "edl") {
        downloadEdl(buildEdl(selected, itemsById), selected.name);
        showNotification?.("تم تنزيل ملف EDL.", { type: "success", category: "export", title: "اكتمل التصدير", targetLabel: selected.name });
      } else if (kind === "mp4") {
        setExporting(true);
        await exportProjectMp4({
          timeline,
          name: selected.name,
          baseUrl: getBackendUrl(),
          getToken: getCloudToken
        });
        showNotification?.("تم تصدير MP4 وتنزيله.", { type: "success", category: "export", title: "اكتمل تصدير MP4", targetLabel: selected.name });
      }
    } catch (error) {
      if (error instanceof CloudExportError) {
        showToast?.(error.message, "error");
      } else {
        reportError(showNotification, error, { context: `تصدير ${kind.toUpperCase()}` });
      }
    } finally {
      if (kind === "mp4") setExporting(false);
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

      projects.length > 0 && jsx("section", {
        className: "grid gap-3 sm:grid-cols-4",
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
        users,
        usersById,
        onBack: closeProject,
        onPatch: patchProject,
        onAddCut: addCut,
        onMoveCut: moveCut,
        onRemoveCut: removeCut,
        onReorderClips: reorderClipsVisual,
        onAddTask: addTask,
        onMoveTask: moveTask,
        onRemoveTask: removeTask,
        onExport: runExport,
        mp4Enabled,
        exporting
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
