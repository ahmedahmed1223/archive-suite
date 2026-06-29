const FOLDER_MARKER = ".archive-folder";

interface FileStoreEntry {
  name: string;
  key: string;
  kind: "file" | "folder";
}

interface ListEntriesResult {
  path: string;
  entries: FileStoreEntry[];
  nextCursor: string | null;
}

interface FileStoreCapabilities {
  folders: boolean;
  copy: boolean;
  move: boolean;
  metadata: boolean;
}

interface FileStore {
  copy?: (from: string, to: string) => Promise<unknown>;
  move?: (from: string, to: string) => Promise<unknown>;
  getBlob?: (key: string) => Promise<Buffer | null>;
  putBlob?: (key: string, blob: Buffer, opts?: unknown) => Promise<unknown>;
  remove?: (key: string) => Promise<void>;
  createFolder?: (path: string) => Promise<unknown>;
  list?: (prefix: string) => Promise<string[]>;
  listEntries?: (path: string, opts: unknown) => Promise<ListEntriesResult>;
  stat?: (key: string) => Promise<unknown>;
}

export function normalizeFileKey(value: unknown, { allowEmpty = false } = {}): string {
  const clean = String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if ((!clean && !allowEmpty) || clean.includes("\0") || clean.split("/").includes("..")) {
    const error = new Error("Invalid file key.");
    (error as any).statusCode = 400;
    throw error;
  }
  return clean;
}

function missingSource(key: string): Error {
  const error = new Error(`File not found: ${key}`);
  (error as any).statusCode = 404;
  return error;
}

export async function copyEntry(store: FileStore, source: string, destination: string): Promise<unknown> {
  const from = normalizeFileKey(source);
  const to = normalizeFileKey(destination);
  if (typeof store?.copy === "function") return store.copy(from, to);
  const blob = await store.getBlob?.(from);
  if (blob == null) throw missingSource(from);
  return store.putBlob?.(to, blob);
}

export async function moveEntry(store: FileStore, source: string, destination: string): Promise<unknown> {
  const from = normalizeFileKey(source);
  const to = normalizeFileKey(destination);
  if (typeof store?.move === "function") return store.move(from, to);
  const result = await copyEntry(store, from, to);
  await store.remove?.(from);
  return result;
}

export async function createFolder(store: FileStore, path: string): Promise<unknown> {
  const clean = normalizeFileKey(path);
  if (typeof store?.createFolder === "function") return store.createFolder(clean);
  await store.putBlob?.(`${clean}/${FOLDER_MARKER}`, Buffer.alloc(0), { contentType: "application/x-directory" });
  return { key: clean, kind: "folder" };
}

export async function removeEntries(store: FileStore, keys: string[] = []): Promise<Array<{ key: string; ok: boolean; error?: string }>> {
  const results: Array<{ key: string; ok: boolean; error?: string }> = [];
  for (const value of keys) {
    const key = normalizeFileKey(value);
    try {
      await store.remove?.(key);
      results.push({ key, ok: true });
    } catch (error) {
      results.push({ key, ok: false, error: (error as any)?.message || "Delete failed" });
    }
  }
  return results;
}

export async function listEntries(store: FileStore, path: string = "", { query = "", limit = 200, cursor = "" } = {}): Promise<ListEntriesResult> {
  const cleanPath = normalizeFileKey(path, { allowEmpty: true });
  if (typeof store?.listEntries === "function") {
    return store.listEntries(cleanPath, { query, limit, cursor });
  }

  const prefix = cleanPath ? `${cleanPath}/` : "";
  const keys = await store.list?.(prefix);
  const entries = new Map<string, FileStoreEntry>();
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase();

  for (const rawKey of keys || []) {
    const key = String(rawKey || "").replace(/\\/g, "/");
    if (!key.startsWith(prefix)) continue;
    const remainder = key.slice(prefix.length);
    if (!remainder || remainder === FOLDER_MARKER) continue;
    const [name, ...rest] = remainder.split("/");
    if (!name || (normalizedQuery && !name.toLocaleLowerCase().includes(normalizedQuery))) continue;
    const kind: "file" | "folder" = rest.length > 0 ? "folder" : "file";
    const existing = entries.get(name);
    if (!existing || kind === "folder") {
      entries.set(name, { name, key: prefix + name, kind });
    }
  }

  const ordered = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  const start = cursor ? Math.max(0, ordered.findIndex((entry) => entry.key === cursor) + 1) : 0;
  const pageSize = Math.max(1, Math.min(200, Number(limit) || 200));
  const page = ordered.slice(start, start + pageSize);
  return {
    path: cleanPath,
    entries: page,
    nextCursor: start + pageSize < ordered.length ? page.at(-1)?.key || null : null
  };
}

export function describeFileStoreCapabilities(store: FileStore): FileStoreCapabilities {
  return {
    folders: typeof store?.createFolder === "function" || typeof store?.putBlob === "function",
    copy: typeof store?.copy === "function" || (typeof store?.getBlob === "function" && typeof store?.putBlob === "function"),
    move: typeof store?.move === "function" || (typeof store?.getBlob === "function" && typeof store?.putBlob === "function" && typeof store?.remove === "function"),
    metadata: typeof store?.stat === "function"
  };
}
