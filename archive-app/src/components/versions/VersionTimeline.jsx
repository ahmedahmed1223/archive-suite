import { jsx, jsxs } from "react/jsx-runtime";
import { History, RotateCcw, ChevronRight } from "lucide-react";

function formatDate(iso) {
  return new Date(iso).toLocaleString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  const hr   = Math.floor(min / 60);
  const day  = Math.floor(hr / 24);
  if (day > 0)  return `منذ ${day} يوم`;
  if (hr > 0)   return `منذ ${hr} ساعة`;
  if (min > 0)  return `منذ ${min} دقيقة`;
  return "الآن";
}

/**
 * Visual timeline of record versions.
 *
 * @param {{
 *   versions: Array<{ id: *, version: number, createdAt: string, userId?: string, snapshot: object }>,
 *   selectedVersion?: number,
 *   onSelect?: (v: object) => void,
 *   onRestore?: (v: object) => void,
 *   currentVersion?: number,
 * }} props
 */
export function VersionTimeline({ versions = [], selectedVersion, onSelect, onRestore, currentVersion }) {
  if (!versions.length) {
    return jsxs("div", {
      className: "flex flex-col items-center justify-center gap-2 py-12 text-gray-600",
      children: [
        jsx(History, { className: "h-10 w-10 opacity-30" }),
        jsx("p", { className: "text-sm", children: "لا توجد إصدارات سابقة" }),
        jsx("p", { className: "text-xs", children: "ستظهر هنا عند كل تعديل على السجل" }),
      ],
    });
  }

  return jsxs("div", {
    className: "relative px-4 py-2",
    children: [
      jsx("div", {
        className: "absolute right-[1.625rem] top-4 bottom-4 w-px bg-white/10",
        "aria-hidden": "true",
      }),

      jsx("ol", {
        className: "space-y-1",
        "aria-label": "تاريخ إصدارات السجل",
        children: versions.map((v, idx) => {
          const isCurrent  = v.version === currentVersion || (currentVersion == null && idx === 0);
          const isSelected = v.version === selectedVersion;

          return jsxs("li", {
            className: "relative flex items-start gap-4",
            children: [
              jsx("span", {
                className: `relative z-10 mt-2.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  isCurrent
                    ? "border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/20"
                    : isSelected
                      ? "border-blue-400 bg-blue-400/20"
                      : "border-white/20 bg-white/5"
                }`,
                "aria-hidden": "true",
              }),

              jsxs("button", {
                type: "button",
                onClick: () => onSelect?.(v),
                className: `group flex min-w-0 flex-1 items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-right transition-colors ${
                  isSelected
                    ? "border-blue-500/30 bg-blue-500/10"
                    : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]"
                }`,
                children: [
                  jsxs("span", {
                    className: "min-w-0 flex-1",
                    children: [
                      jsxs("span", {
                        className: "flex flex-wrap items-center gap-2",
                        children: [
                          jsxs("span", {
                            className: "text-sm font-semibold text-white",
                            children: ["النسخة ", v.version],
                          }),
                          isCurrent && jsx("span", {
                            className: "rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400",
                            children: "الحالية",
                          }),
                        ],
                      }),
                      jsx("span", {
                        className: "block text-xs text-gray-500",
                        title: formatDate(v.createdAt),
                        children: formatRelative(v.createdAt),
                      }),
                      v.userId && jsx("span", {
                        className: "block truncate text-[11px] text-gray-700",
                        children: v.userId,
                      }),
                    ],
                  }),

                  jsxs("span", {
                    className: "flex shrink-0 items-center gap-1.5",
                    children: [
                      jsx(ChevronRight, { className: "h-3.5 w-3.5 text-gray-600 transition-colors group-hover:text-gray-400" }),
                      onRestore && !isCurrent && jsx("span", {
                        onClick: (e) => { e.stopPropagation(); onRestore(v); },
                        title: "استعادة هذه النسخة",
                        role: "button",
                        className: "rounded-lg border border-white/10 p-1 text-gray-500 transition-colors hover:border-emerald-500/30 hover:text-emerald-400",
                        children: jsx(RotateCcw, { className: "h-3.5 w-3.5" }),
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }, v.id ?? v.version);
        }),
      }),
    ],
  });
}
