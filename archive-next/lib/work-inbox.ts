import type { WorkInboxItemType } from "@/lib/generated/archive-api";

// V14-UX-003 (Task 3): pure, stable ordering for the work inbox —
// urgent and near-due items surface first regardless of arrival order.
export type WorkInboxSortItem = {
  id: string;
  type: WorkInboxItemType;
  dueAt: string | null;
};

const TYPE_WEIGHT: Record<WorkInboxItemType, number> = {
  review: 0,
  rights: 1,
  task: 2,
  notification: 3
};

export function sortWorkInboxItems(
  items: readonly WorkInboxSortItem[],
  now: Date = new Date()
): WorkInboxSortItem[] {
  const dueIn = (item: WorkInboxSortItem) =>
    item.dueAt ? Math.max(0, new Date(item.dueAt).getTime() - now.getTime()) : Number.POSITIVE_INFINITY;

  return [...items].sort(
    (left, right) =>
      dueIn(left) - dueIn(right) ||
      TYPE_WEIGHT[left.type] - TYPE_WEIGHT[right.type] ||
      left.id.localeCompare(right.id)
  );
}
