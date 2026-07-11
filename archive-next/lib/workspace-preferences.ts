export const WORKSPACE_PREFERENCES_VERSION = 2;
export const WORKSPACE_PREFERENCES_STORAGE_KEY = "masar.workspace-preferences";

export const workspaceRoutes = [
  "/",
  "/archive",
  "/search",
  "/search/saved",
  "/discover",
  "/favorites",
  "/reading-lists",
  "/timeline",
  "/graph",
  "/catalog"
] as const;

export type WorkspaceRoute = (typeof workspaceRoutes)[number];
export type WorkspaceView = "grid" | "gallery" | "compact" | "list" | "details" | "cards" | "table";
export type WorkspaceDensity = "compact" | "comfortable" | "large";

export interface WorkspaceRoutePreferences {
  view?: WorkspaceView;
  density?: WorkspaceDensity;
  previewId?: string;
  filters?: Record<string, string>;
  workPosition?: number;
}

export interface WorkspacePreferences {
  version: typeof WORKSPACE_PREFERENCES_VERSION;
  routes: Partial<Record<WorkspaceRoute, WorkspaceRoutePreferences>>;
}

export interface WorkspaceResultCount {
  visible: number;
  filtered: number;
  total: number;
  label: string;
}

const validViews: WorkspaceView[] = ["grid", "gallery", "compact", "list", "details", "cards", "table"];
const validDensities: WorkspaceDensity[] = ["compact", "comfortable", "large"];

function isRoute(value: unknown): value is WorkspaceRoute {
  return typeof value === "string" && workspaceRoutes.includes(value as WorkspaceRoute);
}

export function resolveWorkspaceRoute(pathname: string): WorkspaceRoute | null {
  return isRoute(pathname) ? pathname : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanRoutePreferences(value: unknown): WorkspaceRoutePreferences | undefined {
  if (!isRecord(value)) return undefined;
  const next: WorkspaceRoutePreferences = {};
  if (typeof value.view === "string" && validViews.includes(value.view as WorkspaceView)) next.view = value.view as WorkspaceView;
  if (typeof value.density === "string" && validDensities.includes(value.density as WorkspaceDensity)) next.density = value.density as WorkspaceDensity;
  if (typeof value.previewId === "string" && value.previewId.trim()) next.previewId = value.previewId;
  if (isRecord(value.filters)) {
    const filters: Record<string, string> = {};
    for (const [key, filter] of Object.entries(value.filters)) {
      if (typeof filter === "string") filters[key] = filter;
    }
    if (Object.keys(filters).length) next.filters = filters;
  }
  if (typeof value.workPosition === "number" && Number.isInteger(value.workPosition) && value.workPosition >= 0) {
    next.workPosition = value.workPosition;
  }
  return Object.keys(next).length ? next : undefined;
}

export function readWorkspacePreferences(raw: string | null | undefined): WorkspacePreferences {
  const empty: WorkspacePreferences = { version: WORKSPACE_PREFERENCES_VERSION, routes: {} };
  if (!raw) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return empty;
    const routes: WorkspacePreferences["routes"] = {};
    if (parsed.version === 1 && isRoute(parsed.route)) {
      const migrated = cleanRoutePreferences(parsed);
      if (migrated) routes[parsed.route] = migrated;
      return { version: WORKSPACE_PREFERENCES_VERSION, routes };
    }
    if (parsed.version !== WORKSPACE_PREFERENCES_VERSION || !isRecord(parsed.routes)) return empty;
    for (const [route, preferences] of Object.entries(parsed.routes)) {
      if (!isRoute(route)) continue;
      const cleaned = cleanRoutePreferences(preferences);
      if (cleaned) routes[route] = cleaned;
    }
    return { version: WORKSPACE_PREFERENCES_VERSION, routes };
  } catch {
    return empty;
  }
}

export function updateWorkspacePreferences(
  current: WorkspacePreferences,
  route: WorkspaceRoute,
  patch: WorkspaceRoutePreferences
): WorkspacePreferences {
  const nextRoute = cleanRoutePreferences({ ...current.routes[route], ...patch });
  return {
    version: WORKSPACE_PREFERENCES_VERSION,
    routes: { ...current.routes, ...(nextRoute ? { [route]: nextRoute } : {}) }
  };
}

export function deriveWorkspaceResultCount({ total, filtered, page, pageSize }: {
  total: number;
  filtered: number;
  page: number;
  pageSize: number;
}): WorkspaceResultCount {
  const safeTotal = Math.max(0, total);
  const safeFiltered = Math.max(0, Math.min(filtered, safeTotal));
  const start = Math.max(0, (Math.max(1, page) - 1) * Math.max(1, pageSize));
  const visible = Math.max(0, Math.min(Math.max(1, pageSize), safeFiltered - start));
  return { visible, filtered: safeFiltered, total: safeTotal, label: `عرض ${visible} من ${safeFiltered} نتيجة` };
}
