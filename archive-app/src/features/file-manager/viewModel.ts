export const FILE_MANAGER_VIEW_KEY = "archive.fileManager.view";

type FileManagerViewMode = "list" | "grid";

interface BrowserEntry {
  key?: string;
  [key: string]: unknown;
}

interface ViewModeStorage {
  getItem?(key: string): string | null;
  setItem?(key: string, value: string): void;
}

interface Breadcrumb {
  label: string;
  path: string;
}

export function normalizeFileManagerPath(value = ""): string {
  const clean = String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (clean.includes("\0") || clean.split("/").includes("..")) throw new Error("Invalid file manager path.");
  return clean;
}

export function buildBreadcrumbs(path = ""): Breadcrumb[] {
  const clean = normalizeFileManagerPath(path);
  const result: Breadcrumb[] = [{ label: "الملفات", path: "" }];
  let current = "";
  for (const part of clean ? clean.split("/") : []) {
    current = current ? `${current}/${part}` : part;
    result.push({ label: part, path: current });
  }
  return result;
}

export function mergeBrowserEntries<TEntry extends BrowserEntry>(current: TEntry[] = [], incoming: TEntry[] = []): TEntry[] {
  const byKey = new Map((current || []).map((entry) => [entry.key, entry]));
  for (const entry of incoming || []) {
    if (entry?.key) byKey.set(entry.key, { ...byKey.get(entry.key), ...entry });
  }
  return [...byKey.values()].filter(Boolean) as TEntry[];
}

export function toggleSelection(selection: Iterable<string> | null | undefined, key: string): Set<string> {
  const next = new Set(selection || []);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function readViewMode(
  storage: ViewModeStorage | null = typeof localStorage !== "undefined" ? localStorage : null
): FileManagerViewMode {
  const value = storage?.getItem?.(FILE_MANAGER_VIEW_KEY);
  return value === "grid" ? "grid" : "list";
}

export function saveViewMode(
  value: string,
  storage: ViewModeStorage | null = typeof localStorage !== "undefined" ? localStorage : null
): FileManagerViewMode {
  const mode = value === "grid" ? "grid" : "list";
  storage?.setItem?.(FILE_MANAGER_VIEW_KEY, mode);
  return mode;
}

export function joinFileManagerPath(path: string, name: string): string {
  const base = normalizeFileManagerPath(path);
  const child = normalizeFileManagerPath(name);
  return base ? `${base}/${child}` : child;
}

export function parentFileManagerPath(path: string): string {
  const clean = normalizeFileManagerPath(path);
  return clean.includes("/") ? clean.slice(0, clean.lastIndexOf("/")) : "";
}
