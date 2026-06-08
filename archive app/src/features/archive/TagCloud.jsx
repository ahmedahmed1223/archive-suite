import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Tags } from "lucide-react";

import { formatNumber } from "../../utils/formatting.js";

/**
 * Tag-frequency cloud ("سحابة الوسوم"). Pure aggregation over active items;
 * font size scales with usage. Clicking a tag calls onSelect(tag) — the host
 * (Search page) uses it to filter. Lightweight: no deps, reads existing tags.
 */
export function computeTagFrequencies(videoItems = [], { limit = 40 } = {}) {
  const counts = new Map();
  for (const item of videoItems) {
    if (item?.isDeleted) continue;
    for (const rawTag of item?.tags || []) {
      const tag = String(rawTag || "").trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ar"))
    .slice(0, Math.max(1, limit));
}

// Map a count within [min,max] to one of 5 size buckets (text + weight).
const SIZE_BUCKETS = [
  "text-xs text-gray-400",
  "text-sm text-gray-300",
  "text-base text-gray-200 font-medium",
  "text-lg text-white font-semibold",
  "text-xl text-white font-bold"
];

function bucketFor(count, min, max) {
  if (max <= min) return 2;
  const ratio = (count - min) / (max - min);
  return Math.min(SIZE_BUCKETS.length - 1, Math.round(ratio * (SIZE_BUCKETS.length - 1)));
}

export function TagCloud({ videoItems = [], onSelect, activeTag = "", limit = 40, title = "سحابة الوسوم" }) {
  const tags = React.useMemo(() => computeTagFrequencies(videoItems, { limit }), [videoItems, limit]);
  if (!tags.length) return null;
  const max = tags[0].count;
  const min = tags[tags.length - 1].count;
  return jsxs("section", {
    className: "va-card rounded-2xl va-surface-muted border p-4 text-right",
    dir: "rtl",
    children: [
      jsxs("div", { className: "mb-3 flex items-center gap-2", children: [
        jsx(Tags, { className: "h-4 w-4 va-accent-text" }),
        jsx("h3", { className: "text-sm font-bold text-white", children: title }),
        jsx("span", { className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400", children: formatNumber(tags.length) })
      ] }),
      jsx("div", {
        className: "flex flex-wrap items-baseline gap-x-3 gap-y-2",
        children: tags.map(({ tag, count }) => jsxs("button", {
          type: "button",
          onClick: () => onSelect?.(tag),
          title: `${tag} — ${formatNumber(count)}`,
          "aria-pressed": activeTag === tag,
          className: `inline-flex items-baseline gap-1 rounded-lg px-1.5 py-0.5 leading-none transition-colors hover:text-emerald-200 ${SIZE_BUCKETS[bucketFor(count, min, max)]} ${activeTag === tag ? "va-accent-bg-soft va-accent-text-on-soft" : "hover:bg-white/5"}`,
          children: [
            tag,
            jsx("span", { className: "text-[10px] font-normal text-gray-500", children: formatNumber(count) })
          ]
        }, tag))
      })
    ]
  });
}

export default TagCloud;
