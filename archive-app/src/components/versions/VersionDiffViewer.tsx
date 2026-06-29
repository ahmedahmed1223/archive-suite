import { jsx, jsxs } from "react/jsx-runtime";
import { ArrowRight, Plus, Minus, Equal } from "lucide-react";

const FIELD_LABELS = {
  title:       "العنوان",
  description: "الوصف",
  tags:        "الوسوم",
  type:        "النوع",
  folder:      "المجلد",
  status:      "الحالة",
  metadata:    "البيانات التعريفية",
  fileSize:    "حجم الملف",
  duration:    "المدة",
  notes:       "الملاحظات",
  language:    "اللغة",
  source:      "المصدر",
  rating:      "التقييم",
  visibility:  "الظهور",
};

const INTERNAL_KEYS = new Set(["id", "uid", "createdAt", "updatedAt", "_v", "__v"]);

function serializeField(val: any) {
  if (val === null || val === undefined) return "—";
  if (Array.isArray(val)) return val.join("، ");
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function diffSnapshots(before: any, after: any) {
  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after  || {}),
  ]);
  const rows = [];
  for (const key of allKeys) {
    if (INTERNAL_KEYS.has(key)) continue;
    const bStr = serializeField(before?.[key]);
    const aStr = serializeField(after?.[key]);
    const type =
      before?.[key] === undefined ? "added"
      : after?.[key] === undefined ? "removed"
      : bStr === aStr ? "same"
      : "changed";
    rows.push({ key, bStr, aStr, type });
  }
  const order = { changed: 0, added: 1, removed: 2, same: 3 };
  return rows.sort((a: any, b: any) => (order as any)[a.type] - (order as any)[b.type]);
}

const ROW_STYLES = {
  changed: "bg-blue-500/5   border-blue-500/10",
  added:   "bg-emerald-500/5 border-emerald-500/10",
  removed: "bg-red-500/5    border-red-500/10",
  same:    "border-transparent",
};

const TYPE_ICONS  = { changed: ArrowRight, added: Plus, removed: Minus, same: Equal };
const TYPE_COLORS = { changed: "text-blue-400", added: "text-emerald-400", removed: "text-red-400", same: "text-gray-700" };

/**
 * Field-by-field diff between two version snapshots.
 *
 * @param {{
 *   before: object,
 *   after: object,
 *   beforeLabel?: string,
 *   afterLabel?: string,
 *   showUnchanged?: boolean,
 * }} props
 */
export function VersionDiffViewer({
  before,
  after,
  beforeLabel  = "قبل",
  afterLabel   = "بعد",
  showUnchanged = false,
}: any) {
  const rows    = diffSnapshots(before, after);
  const visible = showUnchanged ? rows : rows.filter((r: any) => r.type !== "same");

  const counts = rows.reduce((acc: any, r: any) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});

  return jsxs("div", {
    className: "flex flex-col gap-3",
    children: [
      jsxs("div", {
        className: "flex flex-wrap gap-2 text-xs",
        children: [
          counts.changed > 0 && jsxs("span", {
            className: "flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-blue-300",
            children: [jsx(ArrowRight, { className: "h-3 w-3" }), counts.changed, " معدّل"],
          }),
          counts.added > 0 && jsxs("span", {
            className: "flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-300",
            children: [jsx(Plus, { className: "h-3 w-3" }), counts.added, " مضاف"],
          }),
          counts.removed > 0 && jsxs("span", {
            className: "flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-red-300",
            children: [jsx(Minus, { className: "h-3 w-3" }), counts.removed, " محذوف"],
          }),
        ],
      }),

      !visible.length && jsx("p", {
        className: "py-8 text-center text-sm text-gray-600",
        children: "لا توجد فروقات بين النسختين.",
      }),

      visible.length > 0 && jsx("div", {
        className: "overflow-hidden rounded-xl border border-white/10 bg-black/20",
        children: jsx("table", {
          className: "w-full text-sm",
          children: jsxs("tbody", {
            children: visible.map(({ key, bStr, aStr, type }: any) => {
              const Icon  = (TYPE_ICONS as any)[type];
              const color = (TYPE_COLORS as any)[type];
              return jsxs("tr", {
                className: `border-b border-white/5 last:border-0 ${(ROW_STYLES as any)[type]}`,
                children: [
                  jsx("td", {
                    className: "px-3 py-2 align-top text-[11px] font-medium text-gray-300",
                    children: (FIELD_LABELS as any)[key] || key,
                  }),
                  jsx("td", {
                    className: "px-3 py-2 align-top font-mono text-[11px] text-gray-500",
                    children: jsx("span", { className: "inline-block max-w-[130px] truncate", title: bStr, children: type === "added" ? "" : bStr }),
                  }),
                  jsx("td", {
                    className: `w-6 px-1 py-2 text-center align-middle ${color}`,
                    children: jsx(Icon, { className: "h-3 w-3" }),
                  }),
                  jsx("td", {
                    className: "px-3 py-2 align-top font-mono text-[11px] text-gray-300",
                    children: jsx("span", { className: "inline-block max-w-[130px] truncate", title: aStr, children: type === "removed" ? "" : aStr }),
                  }),
                ],
              }, key);
            }),
          }),
        }),
      }),
    ],
  });
}
