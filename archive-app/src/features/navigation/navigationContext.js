// Context-aware navigation logic (§1408).
//
// Pure, storage-agnostic helpers that decide which navigation surface the user
// should see for the current page/state: the relevant quick-actions strip, the
// detail-page contextual actions, and the next/previous item resolution used to
// step through the current filtered list without returning to the archive.
//
// No React, no DOM, no store access — everything is derived from plain inputs
// so it can be unit-tested in isolation.

/**
 * Quick-action descriptors keyed by page. Each action is a plain object the UI
 * turns into a button. `targetPage` drives `setCurrentPage`; optional `intent`
 * lets the caller branch (e.g. open the add page in a particular mode).
 *
 * Kept intentionally small and high-signal — the goal is page-specific shortcuts,
 * not a duplicate of the full sidebar.
 */
const QUICK_ACTIONS_BY_PAGE = {
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

/**
 * Resolve the quick-action shortcuts relevant to the given page.
 *
 * @param {string} pageId
 * @returns {Array<{id:string,label:string,targetPage:string,intent?:string}>}
 */
export function getQuickActions(pageId = "dashboard") {
  const actions = QUICK_ACTIONS_BY_PAGE[pageId] || DEFAULT_QUICK_ACTIONS;
  // Return fresh copies so callers can never mutate the shared descriptors.
  return actions.map((action) => ({ ...action }));
}

/**
 * Build the contextual action list shown in the detail header. Reflects the
 * live item state: a deleted item offers "restore", an active one offers
 * favorite/edit, and next/previous availability is derived from position.
 *
 * @param {{
 *   item?: object|null,
 *   position?: { index:number, total:number, hasPrevious:boolean, hasNext:boolean },
 *   canEdit?: boolean
 * }} params
 * @returns {Array<{id:string,label:string,disabled?:boolean,kind:string}>}
 */
export function getDetailContextActions({ item = null, position = null, canEdit = true } = {}) {
  if (!item) return [];
  const actions = [];

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

/**
 * Normalize a list of ids into a clean, de-duplicated array of strings,
 * dropping empties. Used to sanitize the navigation order coming from the
 * archive's filtered list before it is persisted/consumed.
 *
 * @param {Array<string|number>} ids
 * @returns {string[]}
 */
export function normalizeNavIds(ids = []) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of ids) {
    if (raw === null || raw === undefined) continue;
    const id = String(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/**
 * Locate the current item inside the navigation order and report its position.
 * Falls back gracefully when the id is missing from the list (e.g. the filtered
 * list changed under the user) by treating it as un-positioned.
 *
 * @param {string} currentId
 * @param {Array<string|number>} navIds
 * @returns {{ index:number, total:number, hasPrevious:boolean, hasNext:boolean }}
 */
export function getItemPosition(currentId, navIds = []) {
  const ids = normalizeNavIds(navIds);
  const total = ids.length;
  const index = currentId === null || currentId === undefined
    ? -1
    : ids.indexOf(String(currentId));
  return {
    index,
    total,
    hasPrevious: index > 0,
    hasNext: index >= 0 && index < total - 1
  };
}

/**
 * Resolve the id of the adjacent item in the navigation order.
 *
 * @param {string} currentId
 * @param {Array<string|number>} navIds  ordered ids of the current filtered list
 * @param {"next"|"previous"} direction
 * @returns {string|null} the adjacent id, or null when there is none / unknown
 */
export function resolveAdjacentItem(currentId, navIds = [], direction = "next") {
  const ids = normalizeNavIds(navIds);
  if (currentId === null || currentId === undefined) return null;
  const index = ids.indexOf(String(currentId));
  if (index === -1) return null;
  const target = direction === "previous" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return null;
  return ids[target];
}

/**
 * Compose the full navigation context for a page in one call: which quick
 * actions are relevant, and (on the detail page) the current item's position
 * plus contextual actions. This is the single entry point UI surfaces consume.
 *
 * @param {{
 *   currentPage?: string,
 *   item?: object|null,
 *   navItemIds?: Array<string|number>,
 *   selectedItemId?: string|null,
 *   canEdit?: boolean
 * }} state
 * @returns {{
 *   pageId: string,
 *   quickActions: Array<object>,
 *   isDetail: boolean,
 *   position: { index:number, total:number, hasPrevious:boolean, hasNext:boolean }|null,
 *   detailActions: Array<object>
 * }}
 */
export function buildNavigationContext(state = {}) {
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
