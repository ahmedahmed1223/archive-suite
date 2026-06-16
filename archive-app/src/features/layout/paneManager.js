/**
 * paneManager — pure state module for split-view pane layout.
 *
 * Persists to localStorage key `va.paneLayout.v1`.
 * Each pane: { id, pageId, sizePct }
 */

const STORAGE_KEY  = "va.paneLayout.v1";
const MAX_PANES    = 3;
const MIN_SIZE_PCT = 15;

export function getStoredPanes() {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    return normalizePanes(parsed);
  } catch {
    return [];
  }
}

export function storePanes(panes) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(panes));
    }
  } catch {}
}

export function clearStoredPanes() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

/**
 * Add a new pane. Returns updated list, or null if already at MAX_PANES.
 */
export function addPane(panes, pageId) {
  if (panes.length >= MAX_PANES) return null;
  return normalizePanes([...panes, { id: generateId(), pageId, sizePct: 0 }]);
}

/**
 * Remove pane by id. Minimum 1 pane remains.
 */
export function removePane(panes, id) {
  if (panes.length <= 1) return panes;
  return normalizePanes(panes.filter((p) => p.id !== id));
}

/**
 * Change the page shown in a pane.
 */
export function setPanePageId(panes, id, pageId) {
  return panes.map((p) => (p.id === id ? { ...p, pageId } : p));
}

/**
 * Resize by dragging the handle between pane[idx] and pane[idx+1].
 * deltaPct > 0 grows the dragged pane, shrinks the next one.
 */
export function resizePane(panes, draggedId, deltaPct) {
  const idx = panes.findIndex((p) => p.id === draggedId);
  if (idx < 0 || idx >= panes.length - 1) return panes;

  const curr = panes[idx];
  const next = panes[idx + 1];
  const clamped = Math.max(
    MIN_SIZE_PCT - curr.sizePct,
    Math.min(deltaPct, next.sizePct - MIN_SIZE_PCT),
  );

  return panes.map((p, i) => {
    if (i === idx)     return { ...p, sizePct: p.sizePct + clamped };
    if (i === idx + 1) return { ...p, sizePct: p.sizePct - clamped };
    return p;
  });
}

// ── internals ─────────────────────────────────────────────────────────────────

function generateId() {
  return `pane_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function normalizePanes(panes) {
  if (panes.length === 0) return panes;
  const total = panes.reduce((s, p) => s + (p.sizePct || 0), 0);
  if (total === 0) {
    const equal = Math.floor(100 / panes.length);
    const rem   = 100 - equal * panes.length;
    return panes.map((p, i) => ({ ...p, sizePct: equal + (i === 0 ? rem : 0) }));
  }
  const scale = 100 / total;
  return panes.map((p) => ({ ...p, sizePct: Math.round(p.sizePct * scale) }));
}
