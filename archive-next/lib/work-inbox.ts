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

const calendarDay = (value: Date, timeZone: string): string | null => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    return null;
  }
};

export function groupWorkInboxItems<T extends WorkInboxSortItem>(
  items: readonly T[],
  now: Date = new Date(),
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): WorkInboxGroup<T>[] {
  const today = calendarDay(now, timeZone);

  const bucket = (item: WorkInboxSortItem): WorkInboxGroupKey => {
    if (!item.dueAt) return "undated";
    const dueAt = new Date(item.dueAt);
    if (Number.isNaN(dueAt.getTime()) || !today) return "undated";
    const dueDay = calendarDay(dueAt, timeZone);
    if (!dueDay) return "undated";
    if (dueDay < today) return "overdue";
    if (dueDay === today) return "today";
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
