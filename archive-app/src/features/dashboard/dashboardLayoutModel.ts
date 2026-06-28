export const DASHBOARD_LAYOUT_VERSION = 1;
export const DASHBOARD_GRID_COLS = 12;

export interface DashboardLayoutItem {
  x: number;
  y: number;
  w: number;
  h: number;
  hidden?: boolean;
  autoHeight?: boolean;
}

export type DashboardLayoutItems = Record<string, DashboardLayoutItem>;

export interface DashboardLayout {
  version: number;
  items: DashboardLayoutItems;
}

export const DASHBOARD_DEFAULT_ITEMS: Record<string, DashboardLayoutItem> = {
  hero:           { x: 0, y: 0,  w: 12, h: 10, autoHeight: true },
  reportStrip:    { x: 0, y: 10, w: 12, h: 6,  autoHeight: true },
  dailyFocus:     { x: 0, y: 16, w: 12, h: 6,  autoHeight: true },
  operations:     { x: 0, y: 22, w: 7,  h: 8,  autoHeight: true },
  distribution:   { x: 7, y: 22, w: 5,  h: 8,  autoHeight: true },
  savedViews:     { x: 0, y: 30, w: 7,  h: 6,  autoHeight: true },
  orgMetrics:     { x: 7, y: 30, w: 5,  h: 6,  autoHeight: true },
  recentItems:    { x: 0, y: 36, w: 7,  h: 8,  autoHeight: true },
  recentActivity: { x: 7, y: 36, w: 5,  h: 8,  autoHeight: true }
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cloneItem(item: DashboardLayoutItem): DashboardLayoutItem {
  return {
    x: item.x, y: item.y, w: item.w, h: item.h,
    hidden: !!item.hidden,
    autoHeight: item.autoHeight !== false
  };
}

export function getDefaultDashboardLayout(): DashboardLayout {
  const items: DashboardLayoutItems = {};
  for (const id of Object.keys(DASHBOARD_DEFAULT_ITEMS)) {
    items[id] = cloneItem(DASHBOARD_DEFAULT_ITEMS[id]);
  }
  return { version: DASHBOARD_LAYOUT_VERSION, items };
}

export function resetDashboardLayout(availableIds: string[] = Object.keys(DASHBOARD_DEFAULT_ITEMS)): DashboardLayout {
  const items: DashboardLayoutItems = {};
  let nextY = 0;
  for (const id of availableIds) {
    const def = DASHBOARD_DEFAULT_ITEMS[id] || { x: 0, y: nextY, w: 12, h: 6, autoHeight: true };
    items[id] = {
      ...cloneItem(def),
      y: nextY,
      hidden: false
    };
    nextY += items[id].h;
  }
  return { version: DASHBOARD_LAYOUT_VERSION, items };
}

function isValidStoredItem(value: unknown): value is DashboardLayoutItem {
  return !!value
    && isFiniteNumber((value as DashboardLayoutItem).x) && isFiniteNumber((value as DashboardLayoutItem).y)
    && isFiniteNumber((value as DashboardLayoutItem).w) && isFiniteNumber((value as DashboardLayoutItem).h)
    && (value as DashboardLayoutItem).w > 0 && (value as DashboardLayoutItem).h > 0
    && (value as DashboardLayoutItem).x >= 0 && (value as DashboardLayoutItem).x < DASHBOARD_GRID_COLS;
}

export function normalizeDashboardLayout(stored: unknown, availableIds: string[] = Object.keys(DASHBOARD_DEFAULT_ITEMS)): DashboardLayout {
  if (!stored || typeof stored !== "object" || (stored as DashboardLayout).version !== DASHBOARD_LAYOUT_VERSION || !(stored as DashboardLayout).items || typeof (stored as DashboardLayout).items !== "object") {
    const items: DashboardLayoutItems = {};
    for (const id of availableIds) items[id] = cloneItem(DASHBOARD_DEFAULT_ITEMS[id] || { x: 0, y: 999, w: 12, h: 6, autoHeight: true });
    return { version: DASHBOARD_LAYOUT_VERSION, items };
  }
  const items: DashboardLayoutItems = {};
  let maxY = 0;
  for (const id of availableIds) {
    const raw = (stored as DashboardLayout).items[id];
    if (isValidStoredItem(raw)) {
      items[id] = {
        x: Math.min(Math.max(0, Math.round(raw.x)), DASHBOARD_GRID_COLS - 1),
        y: Math.max(0, Math.round(raw.y)),
        w: Math.min(Math.max(1, Math.round(raw.w)), DASHBOARD_GRID_COLS),
        h: Math.max(1, Math.round(raw.h)),
        hidden: !!raw.hidden,
        autoHeight: raw.autoHeight !== false
      };
      maxY = Math.max(maxY, items[id].y + items[id].h);
    } else {
      items[id] = null as unknown as DashboardLayoutItem;
    }
  }
  for (const id of availableIds) {
    if (items[id] === null) {
      const def = DASHBOARD_DEFAULT_ITEMS[id] || { w: 12, h: 6, autoHeight: true };
      items[id] = { x: 0, y: maxY, w: def.w, h: def.h, hidden: false, autoHeight: def.autoHeight !== false };
      maxY += items[id].h;
    }
  }
  return { version: DASHBOARD_LAYOUT_VERSION, items };
}

export function toGridLayout(layout: DashboardLayout | null | undefined, availableIds: string[] = Object.keys(DASHBOARD_DEFAULT_ITEMS)) {
  const items = layout?.items || {};
  return availableIds
    .filter((id) => items[id] && !items[id].hidden)
    .map((id) => {
      const it = items[id];
      return {
        i: id,
        x: it.x, y: it.y, w: it.w, h: it.h,
        resizeHandles: it.autoHeight ? ["e", "w"] : ["e", "w", "s", "se", "sw"]
      };
    });
}

export function applyGridChange(layout: DashboardLayout | null | undefined, rglLayout: Array<{ i: string; x: number; y: number; w: number; h: number }> = []): DashboardLayout {
  const next: DashboardLayout = { version: DASHBOARD_LAYOUT_VERSION, items: { ...(layout?.items || {}) } };
  for (const node of rglLayout) {
    const prev = next.items[node.i];
    if (!prev) continue;
    next.items[node.i] = {
      ...prev,
      x: node.x, y: node.y, w: node.w,
      h: node.h
    };
  }
  return next;
}

export function setPanelHidden(layout: DashboardLayout | null | undefined, id: string, hidden: boolean): DashboardLayout {
  const items: DashboardLayoutItems = { ...(layout?.items || {}) };
  if (!items[id]) return layout as DashboardLayout;
  let maxY = 0;
  for (const key of Object.keys(items)) {
    if (!items[key].hidden) maxY = Math.max(maxY, items[key].y + items[key].h);
  }
  items[id] = { ...items[id], hidden, ...(hidden ? {} : { x: 0, y: maxY }) };
  return { version: DASHBOARD_LAYOUT_VERSION, items };
}

export function setPanelAutoHeight(layout: DashboardLayout | null | undefined, id: string, autoHeight: boolean): DashboardLayout {
  const items: DashboardLayoutItems = { ...(layout?.items || {}) };
  if (!items[id]) return layout as DashboardLayout;
  items[id] = { ...items[id], autoHeight: !!autoHeight };
  return { version: DASHBOARD_LAYOUT_VERSION, items };
}

export function hasDashboardLayoutDraftChanges(draftLayout: DashboardLayout | null | undefined, currentLayout: DashboardLayout | null | undefined): boolean {
  const norm = (l: DashboardLayout | null | undefined) => {
    const items = l?.items || {};
    return Object.keys(items).sort().map((id) => {
      const it = items[id] || {};
      const auto = it.autoHeight !== false;
      return [id, it.x, it.y, it.w, auto ? "auto" : it.h, !!it.hidden, auto].join(":");
    }).join("|");
  };
  return norm(draftLayout) !== norm(currentLayout);
}
