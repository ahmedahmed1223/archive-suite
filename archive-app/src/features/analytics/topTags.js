/**
 * Top-tags aggregation (§354 analytics) — pure, no React, unit-testable.
 *
 * Counts tag frequency across active archive items and returns the most-used
 * tags as `{ label, value }[]`, ready for a bar chart. Consumed by
 * `pages/ReportsPage.jsx` → `components/analytics/InteractiveCharts.jsx`.
 */

/**
 * @param {Array<{ tags?: string[], isDeleted?: boolean }>} items
 * @param {number} [limit] maximum number of tags to return
 * @returns {Array<{ label: string, value: number }>} sorted desc by count
 */
export function computeTopTags(items = [], limit = 10) {
  const counts = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || item.isDeleted) continue;
    const tags = Array.isArray(item.tags) ? item.tags : [];
    for (const raw of tags) {
      const label = String(raw || "").trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, limit));
}
