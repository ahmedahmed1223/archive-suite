/**
 * Top-tags aggregation (§354 analytics) — pure, no React, unit-testable.
 */
export interface TopTagItem {
  tags?: unknown;
  isDeleted?: boolean;
}

export interface TopTagCount {
  label: string;
  value: number;
}

export function computeTopTags(items: unknown = [], limit = 10): TopTagCount[] {
  const counts = new Map<string, number>();
  for (const item of Array.isArray(items) ? items as TopTagItem[] : []) {
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
