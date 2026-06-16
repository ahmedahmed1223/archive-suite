import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  Equal,
  HardDrive,
  Merge,
  X
} from "lucide-react";

import { useFocusTrap } from "../../components/common/useFocusTrap.js";
import {
  DIFFABLE_FIELDS,
  applyFieldChoices,
  buildFieldDiff
} from "./fieldDiff.js";

const STATUS_LABEL = {
  identical: "متطابق",
  "local-only": "تغيير محلي فقط",
  "incoming-only": "تغيير وارد فقط",
  "both-changed": "تعارض"
};

const STATUS_CLASS = {
  identical: "border-white/10 bg-white/[0.03] text-gray-400",
  "local-only": "va-accent-border va-accent-bg-soft va-accent-text-on-soft",
  "incoming-only": "border-cyan-500/25 bg-cyan-500/10 text-cyan-200",
  "both-changed": "border-amber-500/30 bg-amber-500/10 text-amber-200"
};

function renderValuePreview(value, kind) {
  if (value === undefined || value === null || value === "") return jsx("span", { className: "text-gray-500", children: "—" });
  if (kind === "boolean") return jsx("span", { className: "font-mono text-xs", children: value ? "نعم" : "لا" });
  if (kind === "stringArray") {
    const list = Array.isArray(value) ? value : [];
    if (!list.length) return jsx("span", { className: "text-gray-500", children: "—" });
    return jsx("div", {
      className: "flex flex-wrap gap-1",
      children: list.map((tag, index) => jsx("span", { className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-200", children: tag }, `${tag}-${index}`))
    });
  }
  if (kind === "object") {
    const entries = value && typeof value === "object" ? Object.entries(value) : [];
    if (!entries.length) return jsx("span", { className: "text-gray-500", children: "—" });
    return jsx("ul", {
      className: "space-y-0.5 text-[11px] text-gray-300",
      children: entries.slice(0, 5).map(([key, val]) => jsxs("li", {
        children: [
          jsx("span", { className: "text-gray-500", children: `${key}: ` }),
          jsx("span", { children: typeof val === "object" ? JSON.stringify(val).slice(0, 40) : String(val).slice(0, 40) })
        ]
      }, key))
    });
  }
  return jsx("span", { className: "block whitespace-pre-wrap break-words text-sm text-gray-200", children: String(value).slice(0, 200) });
}

function FieldChoiceButton({ active, onClick, icon, label, accent }) {
  const colorClass = active
    ? accent === "emerald"
      ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft"
      : accent === "cyan"
        ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
        : "border-amber-500/40 bg-amber-500/15 text-amber-100"
    : "border-white/10 bg-gray-950/35 text-gray-300 hover:bg-white/5";
  return jsxs("button", {
    type: "button",
    onClick,
    "aria-pressed": active,
    className: `inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${colorClass}`,
    children: [icon, label]
  });
}

function FieldRow({ row, choice, onChange }) {
  const isIdentical = row.status === "identical";
  const isConflict = row.status === "both-changed";
  const supportsMerge = row.kind === "stringArray" || row.kind === "object";

  return jsxs("div", {
    className: `rounded-xl border p-3 ${STATUS_CLASS[row.status] || STATUS_CLASS.identical}`,
    children: [
      jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
        jsxs("div", { children: [
          jsx("p", { className: "text-sm font-semibold text-white", children: row.label }),
          jsx("p", { className: "text-[11px] uppercase tracking-wide text-gray-500 font-mono", dir: "ltr", children: row.key })
        ] }),
        jsx("span", { className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px]", children: STATUS_LABEL[row.status] || row.status })
      ] }),
      !isIdentical && jsxs("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: [
        jsxs("div", { className: "rounded-lg border border-white/10 bg-gray-950/40 p-2", children: [
          jsxs("div", { className: "mb-1 flex items-center gap-1.5 text-[11px] font-semibold va-accent-text-on-soft", children: [
            jsx(HardDrive, { className: "h-3 w-3" }),
            "النسخة المحلية"
          ] }),
          renderValuePreview(row.local, row.kind)
        ] }),
        jsxs("div", { className: "rounded-lg border border-white/10 bg-gray-950/40 p-2", children: [
          jsxs("div", { className: "mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200", children: [
            jsx(Download, { className: "h-3 w-3" }),
            "النسخة الواردة"
          ] }),
          renderValuePreview(row.incoming, row.kind)
        ] })
      ] }),
      isConflict && jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: [
        jsx("span", { className: "text-xs text-gray-400", children: "اختَر:" }),
        jsx(FieldChoiceButton, {
          active: choice === "local",
          accent: "emerald",
          icon: jsx(HardDrive, { className: "h-3.5 w-3.5" }),
          label: "محلي",
          onClick: () => onChange("local")
        }),
        jsx(FieldChoiceButton, {
          active: choice === "incoming",
          accent: "cyan",
          icon: jsx(Download, { className: "h-3.5 w-3.5" }),
          label: "وارد",
          onClick: () => onChange("incoming")
        }),
        supportsMerge && jsx(FieldChoiceButton, {
          active: choice === "merge",
          accent: "amber",
          icon: jsx(Merge, { className: "h-3.5 w-3.5" }),
          label: row.kind === "stringArray" ? "دمج (اتحاد)" : "دمج",
          onClick: () => onChange("merge")
        })
      ] })
    ]
  });
}

function ConflictItem({ item, choice, onChange }) {
  const diff = React.useMemo(() => buildFieldDiff({
    local: item.local,
    incoming: item.incoming,
    base: null
  }), [item.local, item.incoming]);
  const conflictRows = diff.filter((row) => row.status !== "identical");
  const identicalCount = diff.length - conflictRows.length;

  const setFieldChoice = (key, value) => onChange({ ...choice, [key]: value });

  return jsxs("section", {
    className: "space-y-3 rounded-2xl border border-white/10 bg-gray-950/40 p-4",
    children: [
      jsxs("header", { className: "flex flex-wrap items-start justify-between gap-3", children: [
        jsxs("div", { children: [
          jsx("h3", { className: "text-base font-bold text-white", children: item.local?.title || item.incoming?.title || item.id }),
          jsxs("p", { className: "mt-1 text-xs text-gray-500", children: [
            "كلا الجهازين عدّلا هذا العنصر منذ آخر مزامنة.",
            ` ${conflictRows.length} حقل متعارض، ${identicalCount} حقل متطابق.`
          ] })
        ] }),
        jsxs("div", { className: "flex flex-wrap gap-2", children: [
          jsx("button", {
            type: "button",
            onClick: () => onChange(Object.fromEntries(DIFFABLE_FIELDS.map((field) => [field.key, "local"]))),
            className: "rounded-lg border va-accent-border va-accent-bg-soft px-3 py-1.5 text-xs font-medium va-accent-text-on-soft hover:bg-emerald-500/15",
            children: "اختر كل المحلي"
          }),
          jsx("button", {
            type: "button",
            onClick: () => onChange(Object.fromEntries(DIFFABLE_FIELDS.map((field) => [field.key, "incoming"]))),
            className: "rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/15",
            children: "اختر كل الوارد"
          })
        ] })
      ] }),
      jsx("div", { className: "space-y-2", children: diff.map((row) => jsx(FieldRow, {
        row,
        choice: choice[row.key],
        onChange: (next) => setFieldChoice(row.key, next)
      }, row.key)) })
    ]
  });
}

/**
 * The conflict resolution modal. Shows one item at a time when there
 * are many conflicts (paginated header). Calls onApply with a map of
 * { itemId: resolvedEntity } once the user clicks "تطبيق الحلول".
 */
export function SyncConflictDialog({ open, conflicts = [], onApply, onCancel }) {
  const dialogRef = React.useRef(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [choices, setChoices] = React.useState({}); // { itemId: { fieldKey: "local"|"incoming"|"merge" } }
  useFocusTrap(dialogRef, open);

  React.useEffect(() => {
    if (!open) {
      setActiveIndex(0);
      setChoices({});
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open || conflicts.length === 0) return null;

  const active = conflicts[Math.min(activeIndex, conflicts.length - 1)];
  const itemChoices = choices[active.id] || {};

  const setActiveItemChoices = (next) => setChoices((current) => ({ ...current, [active.id]: next }));

  const handleApply = () => {
    const resolved = {};
    for (const item of conflicts) {
      const picks = choices[item.id] || {};
      resolved[item.id] = applyFieldChoices({ local: item.local, incoming: item.incoming, choices: picks });
    }
    onApply?.(resolved);
  };

  return jsx(AnimatePresence, {
    children: jsx(motion.div, {
      key: "sync-conflict-overlay",
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      className: "va-dialog-overlay",
      role: "dialog",
      "aria-modal": true,
      "aria-labelledby": "sync-conflict-title",
      onClick: (event) => { if (event.target === event.currentTarget) onCancel?.(); },
      children: jsxs(motion.div, {
        ref: dialogRef,
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 12 },
        transition: { duration: 0.18 },
        className: "va-dialog-card max-w-3xl",
        dir: "rtl",
        style: { width: "min(100%, 56rem)" },
        children: [
          jsxs("header", { className: "flex items-start justify-between gap-3 border-b border-white/10 pb-3", children: [
            jsxs("div", { children: [
              jsxs("h2", { id: "sync-conflict-title", className: "flex items-center gap-2 text-lg font-bold text-white", children: [
                jsx(AlertTriangle, { className: "h-5 w-5 text-amber-300" }),
                "حل تعارضات المزامنة"
              ] }),
              jsx("p", { className: "mt-1 text-xs text-gray-400", children: `تم اكتشاف ${conflicts.length} عنصر تعارضت تعديلاته بين الأجهزة. راجع كل حقل واختر النسخة المناسبة.` })
            ] }),
            jsx("button", { type: "button", onClick: onCancel, className: "rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white", "aria-label": "إلغاء", children: jsx(X, { className: "h-5 w-5" }) })
          ] }),
          conflicts.length > 1 && jsxs("nav", {
            className: "mt-3 flex items-center justify-between gap-2",
            "aria-label": "تنقل بين العناصر المتعارضة",
            children: [
              jsxs("button", {
                type: "button",
                onClick: () => setActiveIndex((value) => Math.max(0, value - 1)),
                disabled: activeIndex <= 0,
                className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40",
                children: [jsx(ChevronRight, { className: "h-3.5 w-3.5" }), "السابق"]
              }),
              jsx("span", { className: "text-xs font-mono text-gray-400", dir: "ltr", children: `${activeIndex + 1} / ${conflicts.length}` }),
              jsxs("button", {
                type: "button",
                onClick: () => setActiveIndex((value) => Math.min(conflicts.length - 1, value + 1)),
                disabled: activeIndex >= conflicts.length - 1,
                className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40",
                children: ["التالي", jsx(ChevronLeft, { className: "h-3.5 w-3.5" })]
              })
            ]
          }),
          jsx("div", { className: "mt-4 max-h-[60vh] overflow-y-auto pe-1", children: jsx(ConflictItem, {
            item: active,
            choice: itemChoices,
            onChange: setActiveItemChoices
          }) }),
          jsxs("footer", { className: "mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4", children: [
            jsxs("p", { className: "text-xs text-gray-500", children: [
              jsx(Equal, { className: "ml-1 inline h-3.5 w-3.5" }),
              "الحقول غير المختارة تستخدم القيمة الواردة كافتراضي"
            ] }),
            jsxs("div", { className: "flex flex-wrap gap-2", children: [
              jsx("button", { type: "button", onClick: onCancel, className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5", children: "إلغاء الاستيراد" }),
              jsxs("button", {
                type: "button",
                onClick: handleApply,
                className: "btn btn-primary gap-2",
                children: [jsx(Cpu, { className: "h-4 w-4" }), `تطبيق الحلول (${conflicts.length})`]
              })
            ] })
          ] })
        ]
      })
    })
  });
}

export default SyncConflictDialog;
