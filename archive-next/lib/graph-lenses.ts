import type { AppLocale } from "@/lib/i18n/types";

export const GRAPH_LENS_STORAGE_KEY = "archive.graph.lens";

export interface GraphLens {
  id: string;
  label: string;
  count: number;
}

export function buildGraphLenses(nodes: ReadonlyArray<{ type?: string | null }>, locale: AppLocale = "ar"): GraphLens[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const type = node.type?.trim() || "record";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  const typeLenses = [...counts.entries()]
    .sort(([leftType, leftCount], [rightType, rightCount]) =>
      rightCount - leftCount ||
      (leftType === "record" ? (locale === "ar" ? "سجل" : "Record") : leftType).localeCompare(
        rightType === "record" ? (locale === "ar" ? "سجل" : "Record") : rightType,
        locale,
      ),
    )
    .map(([id, count]) => ({ id, label: id === "record" ? (locale === "ar" ? "سجل" : "Record") : id, count }));

  return [{ id: "all", label: locale === "ar" ? "كل الأنواع" : "All types", count: nodes.length }, ...typeLenses];
}

export function resolveGraphLens(savedId: string | null, lenses: readonly GraphLens[]) {
  return savedId && lenses.some((lens) => lens.id === savedId) ? savedId : "all";
}
