// Pure helpers for the customizable sidebar. No React/DOM here so the logic
// stays unit-testable (scripts/verify-modules.mjs). The Sidebar component owns
// rendering + edit-mode wiring; this module only shapes/validates layout data.
//
// Layout shape (persisted under settings.ui.sidebarLayout):
//   { version, collapsed: bool, items: { [pageId]: { order, hidden, pinned } } }

export const SIDEBAR_LAYOUT_VERSION = 1;

/** Fresh default layout covering exactly `availableIds` (in their given order). */
export function getDefaultSidebarLayout(availableIds = []) {
  const items = {};
  availableIds.forEach((id, index) => {
    items[id] = { order: index, hidden: false, pinned: false };
  });
  return { version: SIDEBAR_LAYOUT_VERSION, collapsed: false, items };
}

/**
 * Returns a clean layout that always covers exactly `availableIds`:
 * - corrupt input / wrong version -> default
 * - ids missing from storage      -> appended at the end (default flags)
 * - ids in storage but not in code -> dropped
 */
export function normalizeSidebarLayout(stored, availableIds = []) {
  if (!stored || typeof stored !== "object" || stored.version !== SIDEBAR_LAYOUT_VERSION || !stored.items || typeof stored.items !== "object") {
    return getDefaultSidebarLayout(availableIds);
  }
  const items = {};
  availableIds.forEach((id, index) => {
    const raw = stored.items[id];
    items[id] = (raw && typeof raw === "object")
      ? {
          order: Number.isFinite(raw.order) ? raw.order : index,
          hidden: !!raw.hidden,
          pinned: !!raw.pinned
        }
      : { order: index, hidden: false, pinned: false };
  });
  return { version: SIDEBAR_LAYOUT_VERSION, collapsed: !!stored.collapsed, items };
}

function flagsFor(layout, id, fallbackOrder = 0) {
  const raw = layout?.items?.[id];
  return raw && typeof raw === "object"
    ? { order: Number.isFinite(raw.order) ? raw.order : fallbackOrder, hidden: !!raw.hidden, pinned: !!raw.pinned }
    : { order: fallbackOrder, hidden: false, pinned: false };
}

/**
 * Shapes nav groups for rendering given the layout.
 * @returns {{ pinned: object[], groups: {id,label,pages:object[]}[] }}
 *   - `pinned`: pages flagged pinned (pulled out of their group), order-sorted.
 *   - `groups`: remaining (non-pinned) pages per group, order-sorted.
 * Each returned page is augmented with `_hidden`/`_pinned`/`_order`.
 * In view mode (editing=false) hidden pages are excluded; in edit mode they are
 * kept (so the user can toggle them) and groups are kept even if all hidden.
 */
export function applySidebarLayout(groups = [], layout, { editing = false } = {}) {
  let counter = 0;
  const decorate = (page) => {
    const f = flagsFor(layout, page.id, counter++);
    return { ...page, _hidden: f.hidden, _pinned: f.pinned, _order: f.order };
  };
  const byOrder = (a, b) => a._order - b._order;
  const keep = (page) => editing || !page._hidden;

  const pinned = [];
  const outGroups = [];
  for (const group of groups) {
    const decorated = (group.pages || []).map(decorate);
    for (const page of decorated) {
      if (page._pinned && keep(page)) pinned.push(page);
    }
    const rest = decorated.filter((page) => !page._pinned && keep(page)).sort(byOrder);
    if (rest.length > 0) outGroups.push({ id: group.id, label: group.label, pages: rest });
  }
  pinned.sort(byOrder);
  return { pinned, groups: outGroups };
}

export function setSidebarCollapsed(layout, collapsed) {
  return { ...layout, version: SIDEBAR_LAYOUT_VERSION, collapsed: !!collapsed, items: { ...(layout?.items || {}) } };
}

export function setSidebarItemHidden(layout, id, hidden) {
  const items = { ...(layout?.items || {}) };
  if (!items[id]) return layout;
  items[id] = { ...items[id], hidden: !!hidden };
  return { version: SIDEBAR_LAYOUT_VERSION, collapsed: !!layout?.collapsed, items };
}

export function setSidebarItemPinned(layout, id, pinned) {
  const items = { ...(layout?.items || {}) };
  if (!items[id]) return layout;
  items[id] = { ...items[id], pinned: !!pinned };
  return { version: SIDEBAR_LAYOUT_VERSION, collapsed: !!layout?.collapsed, items };
}

/**
 * Move `id` up/down by swapping its `order` with the adjacent item in the same
 * visual list. `listIds` is the current ordered id sequence of that list.
 */
export function reorderSidebarItem(layout, listIds = [], id, direction = "up") {
  const index = listIds.indexOf(id);
  if (index < 0) return layout;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= listIds.length) return layout;
  const otherId = listIds[target];
  const items = { ...(layout?.items || {}) };
  if (!items[id] || !items[otherId]) return layout;
  const a = items[id].order;
  const b = items[otherId].order;
  items[id] = { ...items[id], order: b };
  items[otherId] = { ...items[otherId], order: a };
  return { version: SIDEBAR_LAYOUT_VERSION, collapsed: !!layout?.collapsed, items };
}

/** True when draft differs from current (ignores nothing — collapse + flags + order). */
export function hasSidebarLayoutDraftChanges(draft, current) {
  const norm = (l) => {
    const items = l?.items || {};
    const body = Object.keys(items).sort().map((id) => {
      const it = items[id] || {};
      return [id, it.order, !!it.hidden, !!it.pinned].join(":");
    }).join("|");
    return `${l?.collapsed ? "c" : "e"}#${body}`;
  };
  return norm(draft) !== norm(current);
}
