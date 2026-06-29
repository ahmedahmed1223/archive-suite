import { jsx, jsxs } from "react/jsx-runtime";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { SETTINGS_CATEGORY_LABELS } from "../../features/settings/settingsRegistry.js";

function formatValue(val: any) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "نعم" : "لا";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

/**
 * Shows which settings will change when an import is applied.
 * @param {{ diffs: Array<{entry: object, currentValue: *, nextValue: *}>, onConfirm: () => void, onCancel: () => void }} props
 */
export function SettingDiffPreview({ diffs = [], onConfirm, onCancel }: any) {
  if (!diffs.length) {
    return jsxs("div", {
      className: "rounded-xl border border-white/10 bg-white/[0.025] p-6 text-center",
      children: [
        jsx("p", { className: "text-sm text-gray-400", children: "لا توجد فروقات — الإعدادات المستوردة مطابقة للإعدادات الحالية." }),
        jsx("button", {
          type: "button",
          onClick: onCancel,
          className: "mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white",
          children: "إغلاق",
        }),
      ],
    });
  }

  const hasRestartRequired = diffs.some((d: any) => d.entry.restartRequired);

  return jsxs("div", {
    className: "flex flex-col gap-4",
    children: [
      jsxs("div", {
        className: "flex items-center justify-between gap-4",
        children: [
          jsxs("p", {
            className: "text-sm text-gray-300",
            children: [
              jsx("span", { className: "va-number-badge text-white", children: diffs.length }),
              " إعداد سيتغير عند التطبيق.",
            ],
          }),
          hasRestartRequired && jsxs("span", {
            className: "flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300",
            children: [
              jsx(AlertTriangle, { className: "h-3.5 w-3.5" }),
              "يتطلب إعادة تشغيل",
            ],
          }),
        ],
      }),

      jsx("div", {
        className: "max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-black/20",
        children: jsx("table", {
          className: "w-full text-sm",
          children: jsxs("tbody", {
            children: diffs.map(({ entry, currentValue, nextValue }: any, idx: any) => (
              jsxs("tr", {
                className: `border-b border-white/5 last:border-0 ${entry.restartRequired ? "bg-amber-500/5" : ""}`,
                children: [
                  jsxs("td", {
                    className: "px-4 py-3 text-right align-top",
                    children: [
                      jsx("span", { className: "block font-medium text-white", children: entry.label }),
                      jsx("span", { className: "block text-[11px] text-gray-500", children: (SETTINGS_CATEGORY_LABELS as any)[entry.category] || entry.category }),
                    ],
                  }),
                  jsx("td", {
                    className: "px-4 py-3 align-top font-mono text-xs text-red-400/80",
                    children: jsx("span", {
                      className: "inline-block max-w-[120px] truncate rounded bg-red-500/10 px-1.5 py-0.5",
                      title: formatValue(currentValue),
                      children: formatValue(currentValue),
                    }),
                  }),
                  jsx("td", {
                    className: "px-3 py-3 text-gray-600",
                    children: jsx(ArrowRight, { className: "h-3.5 w-3.5" }),
                  }),
                  jsx("td", {
                    className: "px-4 py-3 align-top font-mono text-xs text-emerald-400/80",
                    children: jsx("span", {
                      className: "inline-block max-w-[120px] truncate rounded bg-emerald-500/10 px-1.5 py-0.5",
                      title: formatValue(nextValue),
                      children: formatValue(nextValue),
                    }),
                  }),
                ],
              }, `${entry.id}-${idx}`)
            )),
          }),
        }),
      }),

      jsxs("div", {
        className: "flex items-center justify-end gap-3",
        children: [
          jsx("button", {
            type: "button",
            onClick: onCancel,
            className: "rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white",
            children: "إلغاء",
          }),
          jsx("button", {
            type: "button",
            onClick: onConfirm,
            className: "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500",
            children: "تطبيق الإعدادات",
          }),
        ],
      }),
    ],
  });
}
