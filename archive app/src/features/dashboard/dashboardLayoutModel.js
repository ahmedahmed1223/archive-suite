// Pure helpers for the customizable dashboard grid. No React / DOM here so the
// logic stays unit-testable (scripts/verify-modules.mjs). The DashboardGrid
// component owns rendering, drag/resize wiring and the ResizeObserver that
// drives auto-height; this module only shapes and validates layout data.

export const DASHBOARD_LAYOUT_VERSION = 1;
export const DASHBOARD_GRID_COLS = 12;

// Default position of every panel on the 12-col grid. `h` is an initial guess;
// when `autoHeight` is on the grid recomputes it from measured content. Order
// mirrors the pre-customization dashboard (hero, metrics, focus, then the
// two-column operational rows).
export const DASHBOARD_DEFAULT_ITEMS = {
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

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function cloneItem(item) {
  return {
    x: item.x, y: item.y, w: item.w, h: item.h,
    hidden: !!item.hidden,
    autoHeight: item.autoHeight !== false
  };
}

/** Fresh copy of the default layout. */
export function getDefaultDashboardLayout() {
  const items = {};
  for (const id of Object.keys(DASHBOARD_DEFAULT_ITEMS)) {
    items[id] = cloneItem(DASHBOARD_DEFAULT_ITEMS[id]);
  }
  return { version: DASHBOARD_LAYOUT_VERSION, items };
}

function isValidStoredItem(value) {
  return value
    && isFiniteNumber(value.x) && isFiniteNumber(value.y)
    && isFiniteNumber(value.w) && isFiniteNumber(value.h)
    && value.w > 0 && value.h > 0
    && value.x >= 0 && value.x < DASHBOARD_GRID_COLS;
}

/**
 * Returns a clean layout that always covers exactly `availableIds`:
 * - corrupt input or wrong version  -> default layout
 * - panels present in code but missing from storage -> appended (default pos)
 * - panels in storage but no longer in code -> dropped
 * - per-item invalid geometry -> that item reset to its default
 */
export function normalizeDashboardLayout(stored, availableIds = Object.keys(DASHBOARD_DEFAULT_ITEMS)) {
  const fallback = getDefaultDashboardLayout();
  if (!stored || typeof stored !== "object" || stored.version !== DASHBOARD_LAYOUT_VERSION || !stored.items || typeof stored.items !== "object") {
    // keep only available ids in the fallback
    const items = {};
    for (const id of availableIds) items[id] = cloneItem(DASHBOARD_DEFAULT_ITEMS[id] || { x: 0, y: 999, w: 12, h: 6, autoHeight: true });
    return { version: DASHBOARD_LAYOUT_VERSION, items };
  }
  const items = {};
  let maxY = 0;
  for (const id of availableIds) {
    const raw = stored.items[id];
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
      items[id] = null; // mark for append after we know maxY
    }
  }
  // append panels that were missing/invalid below everything else
  for (const id of availableIds) {
    if (items[id] === null) {
      const def = DASHBOARD_DEFAULT_ITEMS[id] || { w: 12, h: 6, autoHeight: true };
      items[id] = { x: 0, y: maxY, w: def.w, h: def.h, hidden: false, autoHeight: def.autoHeight !== false };
      maxY += items[id].h;
    }
  }
  return { version: DASHBOARD_LAYOUT_VERSION, items };
}

/** RGL layout array for the VISIBLE panels only. */
export function toGridLayout(layout, availableIds = Object.keys(DASHBOARD_DEFAULT_ITEMS)) {
  const items = layout?.items || {};
  return availableIds
    .filter((id) => items[id] && !items[id].hidden)
    .map((id) => {
      const it = items[id];
      return {
        i: id,
        x: it.x, y: it.y, w: it.w, h: it.h,
        // height resize disabled while auto-height is on (width-only resize)
        resizeHandles: it.autoHeight ? ["e", "w"] : ["e", "w", "s", "se", "sw"]
      };
    });
}

/** Merge RGL's reported positions back into the stored layout object. */
export function applyGridChange(layout, rglLayout = []) {
  const next = { version: DASHBOARD_LAYOUT_VERSION, items: { ...(layout?.items || {}) } };
  for (const node of rglLayout) {
    const prev = next.items[node.i];
    if (!prev) continue;
    next.items[node.i] = {
      ...prev,
      x: node.x, y: node.y, w: node.w,
      // when auto-height, keep the measured h (RGL still reports it, accept it)
      h: node.h
    };
  }
  return next;
}

/** Toggle a panel's visibility (and place it at the bottom when re-shown). */
export function setPanelHidden(layout, id, hidden) {
  const items = { ...(layout?.items || {}) };
  if (!items[id]) return layout;
  let maxY = 0;
  for (const key of Object.keys(items)) {
    if (!items[key].hidden) maxY = Math.max(maxY, items[key].y + items[key].h);
  }
  items[id] = { ...items[id], hidden, ...(hidden ? {} : { x: 0, y: maxY }) };
  return { version: DASHBOARD_LAYOUT_VERSION, items };
}

/** Toggle auto-height for a panel. */
export function setPanelAutoHeight(layout, id, autoHeight) {
  const items = { ...(layout?.items || {}) };
  if (!items[id]) return layout;
  items[id] = { ...items[id], autoHeight: !!autoHeight };
  return { version: DASHBOARD_LAYOUT_VERSION, items };
}

/**
 * True when the draft differs from the saved layout. Compares the meaningful
 * geometry (x/y/w/h/hidden/autoHeight) regardless of key order.
 */
export function hasDashboardLayoutDraftChanges(draftLayout, currentLayout) {
  const norm = (l) => {
    const items = l?.items || {};
    return Object.keys(items).sort().map((id) => {
      const it = items[id] || {};
      const auto = it.autoHeight !== false;
      // Ignore `h` for auto-height panels: it is measured from content and
      // drifts in view mode, so it must not count as an unsaved user change.
      return [id, it.x, it.y, it.w, auto ? "auto" : it.h, !!it.hidden, auto].join(":");
    }).join("|");
  };
  return norm(draftLayout) !== norm(currentLayout);
}
