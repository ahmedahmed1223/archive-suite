// V14-UX-003 (Task 3): pure, stable ordering for the work inbox —
// urgent and near-due items surface first regardless of arrival order.
export type WorkInboxSortItem = {
  id: string;
  type: "review" | "rights" | "task" | "notification" | "processing" | "export";
  dueAt: string | null;
};

const TYPE_WEIGHT: Record<WorkInboxSortItem["type"], number> = {
  review: 0,
  rights: 1,
  task: 2,
  notification: 3,
  processing: 4,
  export: 5,
};

export function sortWorkInboxItems<T extends WorkInboxSortItem>(
  items: readonly T[],
  now: Date = new Date()
): T[] {
  const dueIn = (item: WorkInboxSortItem) =>
    item.dueAt
      ? Math.max(0, new Date(item.dueAt).getTime() - now.getTime())
      : Number.POSITIVE_INFINITY;

  return [...items].sort(
    (left, right) =>
      dueIn(left) - dueIn(right) ||
      TYPE_WEIGHT[left.type] - TYPE_WEIGHT[right.type] ||
      left.id.localeCompare(right.id)
  );
}

// ── V15-DAILY-001: urgency grouping ──────────────────────────────
export type WorkInboxGroupKey = "overdue" | "today" | "upcoming" | "undated";

export type WorkInboxGroup<T extends WorkInboxSortItem> = {
  key: WorkInboxGroupKey;
  items: T[];
};

const GROUP_ORDER: WorkInboxGroupKey[] = [
  "overdue",
  "today",
  "upcoming",
  "undated",
];

const startOfLocalDay = (now: Date): number => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const endOfLocalDay = (now: Date): number => {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

export function groupWorkInboxItems<T extends WorkInboxSortItem>(
  items: readonly T[],
  now: Date = new Date()
): WorkInboxGroup<T>[] {
  const dayStart = startOfLocalDay(now);
  const dayEnd = endOfLocalDay(now);

  const bucket = (item: WorkInboxSortItem): WorkInboxGroupKey => {
    if (!item.dueAt) return "undated";
    const t = new Date(item.dueAt).getTime();
    if (Number.isNaN(t)) return "undated";
    if (t < dayStart) return "overdue";
    if (t <= dayEnd) return "today";
    return "upcoming";
  };

  const byKey: Record<WorkInboxGroupKey, T[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    undated: [],
  };

  for (const item of sortWorkInboxItems(items, now)) {
    byKey[bucket(item)].push(item);
  }

  return GROUP_ORDER.filter((key) => byKey[key].length > 0).map((key) => ({
    key,
    items: byKey[key],
  }));
}
