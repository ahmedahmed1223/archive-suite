import { jsx, jsxs } from "react/jsx-runtime";

function formatDiffValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Renders the changed-fields map of an activity entry:
 * { field: { before, after } } as RTL before/after rows.
 */
export function DiffView({ diff }) {
  const entries = Object.entries(diff || {});
  if (!entries.length) {
    return jsx("p", { className: "text-xs text-gray-500", children: "لا توجد فروقات مسجلة لهذا النشاط." });
  }
  return jsx("div", {
    className: "space-y-2",
    dir: "rtl",
    children: entries.map(([field, change]) => jsxs("div", {
      className: "rounded-xl va-surface-muted border p-3 text-xs",
      children: [
        jsx("p", { className: "mb-2 font-semibold text-white", children: `الحقل: ${field}` }),
        jsxs("div", {
          className: "grid gap-1.5 md:grid-cols-2",
          children: [
            jsxs("div", {
              className: "min-w-0 rounded-lg border border-red-500/15 bg-red-500/8 p-2",
              children: [
                jsx("p", { className: "mb-1.5 font-semibold text-red-300", children: "قبل" }),
                jsx("p", { className: "break-words font-mono text-gray-400", dir: "auto", children: formatDiffValue(change?.before) })
              ]
            }),
            jsxs("div", {
              className: "min-w-0 rounded-lg border va-accent-border va-accent-bg-soft p-2",
              children: [
                jsx("p", { className: "mb-1.5 font-semibold va-accent-text", children: "بعد" }),
                jsx("p", { className: "break-words font-mono text-gray-400", dir: "auto", children: formatDiffValue(change?.after) })
              ]
            })
          ]
        })
      ]
    }, field))
  });
}

export default DiffView;
