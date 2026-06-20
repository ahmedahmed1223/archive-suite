export const FILE_MANAGER_VIEW_KEY = "archive.fileManager.view";

export function normalizeFileManagerPath(value = "") {
  const clean = String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (clean.includes("\0") || clean.split("/").includes("..")) throw new Error("Invalid file manager path.");
  return clean;
}

export function buildBreadcrumbs(path = "") {
  const clean = normalizeFileManagerPath(path);
  const result = [{ label: "الملفات", path: "" }];
  let current = "";
  for (const part of clean ? clean.split("/") : []) {
    current = current ? `${current}/${part}` : part;
    result.push({ label: part, path: current });
  }
  return result;
}

export function mergeBrowserEntries(current = [], incoming = []) {
  const byKey = new Map((current || []).map((entry) => [entry.key, entry]));
  for (const entry of incoming || []) if (entry?.key) byKey.set(entry.key, { ...byKey.get(entry.key), ...entry });
  return [...byKey.values()];
}

export function toggleSelection(selection, key) {
  const next = new Set(selection || []);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

export function readViewMode(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  const value = storage?.getItem?.(FILE_MANAGER_VIEW_KEY);
  return value === "grid" ? "grid" : "list";
}

export function saveViewMode(value, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  const mode = value === "grid" ? "grid" : "list";
  storage?.setItem?.(FILE_MANAGER_VIEW_KEY, mode);
  return mode;
}

export function joinFileManagerPath(path, name) {
  const base = normalizeFileManagerPath(path);
  const child = normalizeFileManagerPath(name);
  return base ? `${base}/${child}` : child;
}

export function parentFileManagerPath(path) {
  const clean = normalizeFileManagerPath(path);
  return clean.includes("/") ? clean.slice(0, clean.lastIndexOf("/")) : "";
}
