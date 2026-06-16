import {
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  HardDrive,
  RefreshCw,
  Upload
} from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";

import { formatNumber } from "../../utils/formatting.js";

const tabIconMap = {
  export: Download,
  import: Upload,
  transfer: RefreshCw,
  backup: HardDrive
};

const sourceTypeLabels = {
  json: "ملف JSON",
  excel: "ملف Excel صادر من التطبيق",
  transfer: "ملف نقل بين الأجهزة"
};

export function PageCard({ children, className = "" }) {
  return jsx("section", {
    className: `card card-border va-surface-muted p-5 text-right backdrop-blur-sm ${className}`,
    dir: "rtl",
    children
  });
}

export function DataMetric({ label, value, hint, icon }) {
  return jsxs(PageCard, {
    className: "va-metric-card min-h-[116px]",
    children: [
      jsxs("div", {
        className: "flex items-start justify-between gap-3",
        children: [
          jsxs("div", {
            className: "min-w-0",
            children: [
              jsx("p", { className: "text-sm text-gray-400", children: label }),
              jsx("p", { className: "mt-2 text-2xl font-bold text-white", children: value }),
              hint && jsx("p", { className: "mt-2 text-xs leading-relaxed text-gray-500", children: hint })
            ]
          }),
          jsx("span", {
            className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border va-accent-border va-accent-bg-soft va-accent-text-on-soft",
            children: icon
          })
        ]
      })
    ]
  });
}

export function TaskChoiceCard({ task, active, onClick, count }) {
  const Icon = tabIconMap[task.id] || Database;
  return jsxs("button", {
    type: "button",
    onClick,
    "aria-pressed": active,
    className: `va-action-card grid min-h-[152px] gap-3 rounded-2xl border p-4 text-right transition-colors ${
      active
        ? "va-accent-border va-accent-bg-soft text-[var(--va-text-strong)]"
        : "border-white/10 bg-gray-950/35 text-[var(--va-text)] hover:border-white/20 hover:bg-white/[0.045]"
    }`,
    children: [
      jsxs("div", {
        className: "flex items-start justify-between gap-3",
        children: [
          jsx("span", {
            className: `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
              active ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 bg-white/[0.04] text-[var(--va-text-soft)]"
            }`,
            children: jsx(Icon, { className: "h-5 w-5" })
          }),
          count != null && jsx("span", {
            className: "badge badge-xs border-white/10 bg-black/10 text-[var(--va-text-soft)]",
            children: formatNumber(count)
          })
        ]
      }),
      jsxs("div", {
        children: [
          jsx("h3", { className: "text-base font-bold text-[var(--va-text-strong)]", children: task.label }),
          jsx("p", { className: "mt-1 text-xs leading-6 text-[var(--va-text-soft)]", children: task.detail })
        ]
      }),
      jsxs("div", {
        className: "mt-auto flex flex-wrap items-center gap-2 text-[11px]",
        children: [
          jsx("span", {
            className: `rounded-full border px-2 py-0.5 ${active ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 bg-white/[0.03] text-gray-500"}`,
            children: task.actionLabel
          }),
          jsx("span", {
            className: "rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[var(--va-text-faint)]",
            children: task.risk
          })
        ]
      })
    ]
  });
}

export function TaskStageRail({ stages = [] }) {
  return jsx("ol", {
    className: "grid gap-2 md:grid-cols-4",
    children: stages.map((stage, index) => jsxs("li", {
      className: `rounded-xl border p-3 ${stage.active
        ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft"
        : stage.done
          ? "va-accent-border va-accent-bg/[0.05] text-[var(--va-text)]"
          : "border-white/10 bg-gray-950/30 text-[var(--va-text-faint)]"}`,
      children: [
        jsxs("div", {
          className: "flex items-center gap-2",
          children: [
            jsx("span", {
              className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/20 text-[11px]",
              children: stage.done ? jsx(CheckCircle2, { className: "h-3.5 w-3.5" }) : formatNumber(index + 1)
            }),
            jsx("span", { className: "text-xs font-semibold", children: stage.label })
          ]
        }),
        stage.detail && jsx("p", { className: "mt-1 text-[11px] leading-5 opacity-75", children: stage.detail })
      ]
    }, stage.id || stage.label))
  });
}

export function CollapsibleSummary({ title, description, open, onToggle, children }) {
  return jsxs("section", {
    className: "va-control-surface va-surface-muted rounded-2xl border text-right",
    dir: "rtl",
    children: [
      jsxs("button", {
        type: "button",
        onClick: onToggle,
        "aria-expanded": open,
        className: "flex w-full items-center justify-between gap-3 px-4 py-3 text-right",
        children: [
          jsxs("span", {
            className: "min-w-0",
            children: [
              jsx("span", { className: "block text-sm font-bold text-[var(--va-text-strong)]", children: title }),
              description && jsx("span", { className: "mt-0.5 block text-xs leading-5 text-[var(--va-text-soft)]", children: description })
            ]
          }),
          jsx(ChevronDown, { className: `h-4 w-4 shrink-0 text-[var(--va-text-faint)] transition-transform ${open ? "rotate-180" : ""}` })
        ]
      }),
      open && jsx("div", { className: "border-t border-white/10 p-4", children })
    ]
  });
}

export function TabButton({ tab, active, onClick }) {
  const Icon = tabIconMap[tab.id] || Database;
  return jsxs("button", {
    type: "button",
    role: "tab",
    "aria-selected": active,
    onClick,
    className: `btn btn-sm shrink-0 gap-2 ${active ? "btn-primary" : "btn-ghost"}`,
    children: [
      jsx(Icon, { className: "h-4 w-4 shrink-0" }),
      jsx("span", { className: "min-w-0 truncate", children: tab.label })
    ]
  });
}

export function SegmentedButton({ active, children, onClick, danger = false }) {
  const activeClass = active
    ? danger ? "btn-error" : "btn-primary"
    : "btn-ghost";
  return jsx("button", {
    type: "button",
    onClick,
    "aria-pressed": active,
    className: `btn btn-sm ${activeClass}`,
    children
  });
}

export function ActionButton({ children, icon, onClick, disabled = false, tone = "emerald" }) {
  const toneClass = tone === "amber"
    ? "btn-warning"
    : tone === "red"
      ? "btn-error"
      : "btn-primary";
  return jsxs("button", {
    type: "button",
    onClick,
    disabled,
    className: `btn ${toneClass} gap-2`,
    children: [
      icon,
      children
    ]
  });
}

export function SummaryGrid({ rows }) {
  return jsx("div", {
    className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
    children: rows.map((item) => jsxs("div", {
      className: "card card-border va-surface-muted p-3",
      children: [
        jsx("p", { className: "text-xs text-gray-500", children: item.label }),
        jsx("p", { className: "mt-1 text-sm font-semibold text-gray-100", children: String(item.value) })
      ]
    }, item.label))
  });
}

export function PreviewSummary({ preview }) {
  if (!preview) return null;
  const visibleEntities = preview.summary.entities.filter((entity) => entity.total > 0 || entity.conflictCount > 0 || entity.potentialDuplicateCount > 0);
  return jsxs("div", {
    className: "space-y-3",
    children: [
      jsxs("div", {
        className: "alert alert-success block",
        role: "alert",
        children: [
          jsx("p", { className: "text-sm font-semibold", children: "تمت قراءة الملف بنجاح" }),
          jsxs("p", {
            className: "mt-1 text-xs leading-relaxed",
            children: [
              preview.fileName,
              " - ",
              sourceTypeLabels[preview.sourceType] || "ملف بيانات",
              preview.packageInfo?.checksum ? ` - checksum ${String(preview.packageInfo.checksum).slice(0, 16)}...` : ""
            ]
          })
        ]
      }),
      jsx("div", {
        className: "grid gap-2 sm:grid-cols-2",
        children: [
          ["كل السجلات", preview.summary.totals.records],
          ["جديد", preview.summary.totals.newCount],
          ["مكرر", preview.summary.totals.duplicateCount],
          ["متعارض", preview.summary.totals.conflictCount]
        ].map(([label, value]) => jsxs("div", {
          className: "rounded-xl va-surface-muted border p-3",
          children: [
            jsx("p", { className: "text-xs text-gray-500", children: label }),
            jsx("p", { className: "mt-1 text-xl font-bold text-white", children: formatNumber(value) })
          ]
        }, label))
      }),
      visibleEntities.length > 0 && jsx("div", {
        className: "max-h-[260px] overflow-auto rounded-xl border border-white/5",
        children: visibleEntities.map((entity) => jsxs("div", {
          className: "grid gap-2 border-b border-white/5 bg-gray-950/25 p-3 text-sm last:border-b-0 sm:grid-cols-[1fr_auto]",
          children: [
            jsx("span", { className: "font-medium text-gray-200", children: entity.label }),
            jsx("span", {
              className: "text-gray-400",
              children: `الإجمالي ${entity.total} | جديد ${entity.newCount} | مكرر ${entity.duplicateCount} | متعارض ${entity.conflictCount}`
            })
          ]
        }, entity.key))
      })
    ]
  });
}
