const STORAGE_KEY = "va.paneLayout.v1";
const MAX_PANES = 3;
const MIN_SIZE_PCT = 15;

export function getStoredPanes(): any[] {
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

export function storePanes(panes: any[]): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(panes));
    }
  } catch {}
}

export function clearStoredPanes(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export function addPane(panes: any[], pageId: any): any[] | null {
  if (panes.length >= MAX_PANES) return null;
  return normalizePanes([...panes, { id: generateId(), pageId, sizePct: 0 }]);
}

export function removePane(panes: any[], id: any): any[] {
  if (panes.length <= 1) return panes;
  return normalizePanes(panes.filter((p) => p.id !== id));
}

export function setPanePageId(panes: any[], id: any, pageId: any): any[] {
  return panes.map((p) => (p.id === id ? { ...p, pageId } : p));
}

export function resizePane(panes: any[], draggedId: any, deltaPct: number): any[] {
  const idx = panes.findIndex((p) => p.id === draggedId);
  if (idx < 0 || idx >= panes.length - 1) return panes;
  const curr = panes[idx];
  const next = panes[idx + 1];
  const clamped = Math.max(MIN_SIZE_PCT - curr.sizePct, Math.min(deltaPct, next.sizePct - MIN_SIZE_PCT));
  return panes.map((p, i) => {
    if (i === idx) return { ...p, sizePct: p.sizePct + clamped };
    if (i === idx + 1) return { ...p, sizePct: p.sizePct - clamped };
    return p;
  });
}

function generateId(): string {
  return `pane_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function normalizePanes(panes: any[]): any[] {
  if (panes.length === 0) return panes;
  const total = panes.reduce((s, p) => s + (p.sizePct || 0), 0);
  if (total === 0) {
    const equal = Math.floor(100 / panes.length);
    const rem = 100 - equal * panes.length;
    return panes.map((p, i) => ({ ...p, sizePct: equal + (i === 0 ? rem : 0) }));
  }
  const scale = 100 / total;
  return panes.map((p) => ({ ...p, sizePct: Math.round(p.sizePct * scale) }));
}
