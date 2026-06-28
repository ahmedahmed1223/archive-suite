export const SIDEBAR_LAYOUT_VERSION = 1;

function resolveStoredCollapsed(stored: any): boolean {
  if (!stored || typeof stored !== "object") return false;
  if (typeof stored.collapsed === "boolean") return stored.collapsed;
  return stored.mode === "collapsed";
}

export function resolveSidebarLayoutMode(stored: any): string {
  return resolveStoredCollapsed(stored) ? "collapsed" : "expanded";
}

export function getDefaultSidebarLayout(availableIds: any[] = []): any {
  const items: Record<string, any> = {};
  availableIds.forEach((id, index) => {
    items[id] = { order: index, hidden: false, pinned: false };
  });
  return { version: SIDEBAR_LAYOUT_VERSION, collapsed: false, items };
}

export function normalizeSidebarLayout(stored: any, availableIds: any[] = []): any {
  if (!stored || typeof stored !== "object" || stored.version !== SIDEBAR_LAYOUT_VERSION || !stored.items || typeof stored.items !== "object") {
    return { ...getDefaultSidebarLayout(availableIds), collapsed: resolveStoredCollapsed(stored) };
  }
  const items: Record<string, any> = {};
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
  return { version: SIDEBAR_LAYOUT_VERSION, collapsed: resolveStoredCollapsed(stored), items };
}

function flagsFor(layout: any, id: any, fallbackOrder = 0): any {
  const raw = layout?.items?.[id];
  return raw && typeof raw === "object"
    ? { order: Number.isFinite(raw.order) ? raw.order : fallbackOrder, hidden: !!raw.hidden, pinned: !!raw.pinned }
    : { order: fallbackOrder, hidden: false, pinned: false };
}

export function applySidebarLayout(groups: any[] = [], layout: any, { editing = false }: any = {}): any {
  let counter = 0;
  const decorate = (page: any) => {
    const f = flagsFor(layout, page.id, counter++);
    return { ...page, _hidden: f.hidden, _pinned: f.pinned, _order: f.order };
  };
  const byOrder = (a: any, b: any) => a._order - b._order;
  const keep = (page: any) => editing || !page._hidden;

  const pinned: any[] = [];
  const outGroups: any[] = [];
  for (const group of groups) {
    const decorated = (group.pages || []).map(decorate);
    for (const page of decorated) {
      if (page._pinned && keep(page)) pinned.push(page);
    }
    const rest = decorated.filter((page: any) => !page._pinned && keep(page)).sort(byOrder);
    if (rest.length > 0) outGroups.push({ id: group.id, label: group.label, pages: rest });
  }
  pinned.sort(byOrder);
  return { pinned, groups: outGroups };
}

export function resolveSidebarResponsiveState({ isMobile = false, requestedOpen = false, persistedCollapsed = false, editing = false }: any = {}): any {
  if (isMobile) {
    return { mode: "drawer", drawerOpen: !!requestedOpen, collapsed: false };
  }
  return {
    mode: "desktop",
    drawerOpen: false,
    collapsed: !editing && !!persistedCollapsed
  };
}

export function getSidebarDrawerFrame({ open = false }: any = {}): any {
  return {
    rootClassName: `md:hidden ${open ? "" : "pointer-events-none"}`.trim(),
    contentClassName: "",
    toggleClassName: "pointer-events-auto fixed right-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[61] inline-flex h-11 w-11 items-center justify-center rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] text-[var(--va-text)] shadow-[var(--va-elev-2)] backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 md:hidden",
    sideClassName: "fixed inset-0 z-[60]",
    overlayClassName: "absolute inset-0 pointer-events-auto bg-black/55 backdrop-blur-sm",
    panelClassName: "absolute inset-y-0 start-0 pointer-events-auto va-sidebar h-full overflow-y-auto flex flex-col border-s border-[var(--va-border-soft)] bg-[var(--va-surface)] shadow-[var(--va-elev-popover)]",
    panelStyle: { width: "min(88vw, 320px)" }
  };
}

export function setSidebarCollapsed(layout: any, collapsed: any): any {
  return { ...layout, version: SIDEBAR_LAYOUT_VERSION, collapsed: !!collapsed, items: { ...(layout?.items || {}) } };
}

export function setSidebarItemHidden(layout: any, id: any, hidden: any): any {
  const items = { ...(layout?.items || {}) };
  if (!items[id]) return layout;
  items[id] = { ...items[id], hidden: !!hidden };
  return { version: SIDEBAR_LAYOUT_VERSION, collapsed: !!layout?.collapsed, items };
}

export function setSidebarItemPinned(layout: any, id: any, pinned: any): any {
  const items = { ...(layout?.items || {}) };
  if (!items[id]) return layout;
  items[id] = { ...items[id], pinned: !!pinned };
  return { version: SIDEBAR_LAYOUT_VERSION, collapsed: !!layout?.collapsed, items };
}

export function reorderSidebarItem(layout: any, listIds: any[] = [], id: any, direction = "up"): any {
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

export function hasSidebarLayoutDraftChanges(draft: any, current: any): boolean {
  const norm = (l: any) => {
    const items = l?.items || {};
    const body = Object.keys(items).sort().map((id) => {
      const it = items[id] || {};
      return [id, it.order, !!it.hidden, !!it.pinned].join(":");
    }).join("|");
    return `${l?.collapsed ? "c" : "e"}#${body}`;
  };
  return norm(draft) !== norm(current);
}
