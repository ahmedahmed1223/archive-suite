const QUICK_ACTIONS_BY_PAGE: Record<string, any[]> = {
  dashboard: [
    { id: "add", label: "إضافة مادة", targetPage: "add", intent: "create" },
    { id: "archive", label: "تصفّح الأرشيف", targetPage: "archive" },
    { id: "discover", label: "اكتشاف", targetPage: "discover" }
  ],
  archive: [
    { id: "add", label: "إضافة مادة", targetPage: "add", intent: "create" },
    { id: "search", label: "بحث متقدّم", targetPage: "search" },
    { id: "collections", label: "المجموعات", targetPage: "collections" }
  ],
  detail: [
    { id: "archive", label: "العودة للأرشيف", targetPage: "archive" },
    { id: "add", label: "إضافة مادة", targetPage: "add", intent: "create" }
  ],
  add: [
    { id: "archive", label: "فتح الأرشيف", targetPage: "archive" },
    { id: "add-another", label: "حفظ وإضافة آخر", targetPage: "add", intent: "create-another" }
  ],
  collections: [
    { id: "archive", label: "تصفّح الأرشيف", targetPage: "archive" },
    { id: "add", label: "إضافة مادة", targetPage: "add", intent: "create" }
  ]
};

const DEFAULT_QUICK_ACTIONS = [
  { id: "dashboard", label: "مركز التحكم", targetPage: "dashboard" },
  { id: "archive", label: "الأرشيف", targetPage: "archive" }
];

export function getQuickActions(pageId = "dashboard"): any[] {
  const actions = QUICK_ACTIONS_BY_PAGE[pageId] || DEFAULT_QUICK_ACTIONS;
  return actions.map((action) => ({ ...action }));
}

export function getDetailContextActions({ item = null, position = null, canEdit = true }: any = {}): any[] {
  if (!item) return [];
  const actions: any[] = [];
  const hasPrevious = Boolean(position?.hasPrevious);
  const hasNext = Boolean(position?.hasNext);
  actions.push({ id: "previous", label: "السابق", kind: "nav", disabled: !hasPrevious });
  actions.push({ id: "next", label: "التالي", kind: "nav", disabled: !hasNext });

  if (item.isDeleted) {
    actions.push({ id: "restore", label: "استرجاع", kind: "danger" });
    return actions;
  }

  actions.push({
    id: "favorite",
    label: item.isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة",
    kind: "toggle"
  });
  if (canEdit) actions.push({ id: "edit", label: "تحرير", kind: "primary" });
  return actions;
}

export function normalizeNavIds(ids: any[] = []): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    if (raw === null || raw === undefined) continue;
    const id = String(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function getItemPosition(currentId: any, navIds: any[] = []): any {
  const ids = normalizeNavIds(navIds);
  const total = ids.length;
  const index = currentId === null || currentId === undefined ? -1 : ids.indexOf(String(currentId));
  return {
    index,
    total,
    hasPrevious: index > 0,
    hasNext: index >= 0 && index < total - 1
  };
}

export function resolveAdjacentItem(currentId: any, navIds: any[] = [], direction = "next"): string | null {
  const ids = normalizeNavIds(navIds);
  if (currentId === null || currentId === undefined) return null;
  const index = ids.indexOf(String(currentId));
  if (index === -1) return null;
  const target = direction === "previous" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return null;
  return ids[target];
}

export function buildNavigationContext(state: any = {}): any {
  const {
    currentPage = "dashboard",
    item = null,
    navItemIds = [],
    selectedItemId = null,
    canEdit = true
  } = state;

  const isDetail = currentPage === "detail";
  const position = isDetail ? getItemPosition(selectedItemId ?? item?.id, navItemIds) : null;

  return {
    pageId: currentPage,
    quickActions: getQuickActions(currentPage),
    isDetail,
    position,
    detailActions: isDetail ? getDetailContextActions({ item, position, canEdit }) : []
  };
}
