export function orderPinnedFilters<T extends { id: string }>(items: readonly T[], order: readonly string[]): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((left, right) =>
    (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function movePinnedFilter(order: readonly string[], id: string, offset: -1 | 1): string[] {
  const current = order.indexOf(id);
  const target = current + offset;
  if (current < 0 || target < 0 || target >= order.length) return [...order];
  const next = [...order];
  [next[current], next[target]] = [next[target], next[current]];
  return next;
}
