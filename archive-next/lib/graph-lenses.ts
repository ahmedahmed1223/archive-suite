export const GRAPH_LENS_STORAGE_KEY = "archive.graph.lens";

export interface GraphLens {
  id: string;
  label: string;
  count: number;
}

export function buildGraphLenses(nodes: ReadonlyArray<{ type?: string | null }>): GraphLens[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const type = node.type?.trim() || "record";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  const typeLenses = [...counts.entries()]
    .sort(([leftType, leftCount], [rightType, rightCount]) =>
      rightCount - leftCount ||
      (leftType === "record" ? "سجل" : leftType).localeCompare(
        rightType === "record" ? "سجل" : rightType,
        "ar",
      ),
    )
    .map(([id, count]) => ({ id, label: id === "record" ? "سجل" : id, count }));

  return [{ id: "all", label: "كل الأنواع", count: nodes.length }, ...typeLenses];
}

export function resolveGraphLens(savedId: string | null, lenses: readonly GraphLens[]) {
  return savedId && lenses.some((lens) => lens.id === savedId) ? savedId : "all";
}
