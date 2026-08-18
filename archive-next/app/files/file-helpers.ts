// Pure, framework-free helpers for classifying, formatting, and mapping
// file/storage data on the files page. Extracted out of page.tsx so this
// logic is directly unit-testable without mounting the page.
import type { ArchiveFile, StorageWorkspaceOperation, StorageWorkspaceProvider } from "@/lib/archive-api";
import type { StorageCapability, StorageProvider } from "@/components/StorageBrowser";
import type { StorageOperationView } from "@/components/StorageOperationPanel";

export type FileKind = "all" | "media" | "image" | "document" | "other";

export const PLAYABLE_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "opus",
  "weba",
  "mp4",
  "m4v",
  "mov",
  "webm",
  "ogv"
]);

const capabilityMap: Record<string, StorageCapability> = {
  create_folder: "create-folder",
  browse: "browse",
  download: "download",
  upload: "upload",
  move: "move",
  copy: "copy",
  rename: "rename",
  delete: "delete"
};

export function mapProvider(provider: StorageWorkspaceProvider): StorageProvider {
  return {
    ...provider,
    status: provider.status === "available" ? "ready" : "offline",
    capabilities: provider.capabilities.map((item) => capabilityMap[item]).filter((item): item is StorageCapability => Boolean(item))
  };
}

export function mapOperation(operation: StorageWorkspaceOperation): StorageOperationView {
  const completed = operation.items.filter((item) => item.status === "completed" || item.status === "skipped").length;
  return {
    id: operation.id,
    type: operation.action,
    status: operation.status === "queued" || operation.status === "paused" ? "running" : operation.status,
    completedItems: completed,
    totalItems: operation.items.length,
    message: operation.items.find((item) => item.errorCode)?.errorCode ?? undefined,
    retryable: operation.status === "failed"
  };
}

// V2-605: ArchiveFile and FileBrowserEntry are two separate interfaces that
// both happen to carry `key` plus a `[key: string]: unknown` catch-all --
// structurally incompatible for direct assignment (an index signature typed
// `unknown` doesn't satisfy an explicit `mimeType?: string`), which is why
// call sites reached for `as unknown as ArchiveFile`. These helpers only
// ever read `key`/`mimeType`/`store`, defensively type-narrowed already, so
// they accept the common shape both real types satisfy without any cast.
export interface FileLike extends Record<string, unknown> {
  key: string;
}

export function getFileExtension(file: FileLike) {
  return file.key.split(".").pop()?.toLowerCase() ?? "";
}

export function isPlayableFile(file: FileLike): boolean {
  const mimeType = typeof file.mimeType === "string" ? file.mimeType : "";
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    return true;
  }

  return PLAYABLE_EXTENSIONS.has(getFileExtension(file));
}

export function getFileKind(file: FileLike): Exclude<FileKind, "all"> {
  const mimeType = typeof file.mimeType === "string" ? file.mimeType : "";
  const ext = getFileExtension(file);

  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/") || PLAYABLE_EXTENSIONS.has(ext)) return "media";
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "tiff", "svg"].includes(ext)) return "image";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"].includes(ext)) return "document";
  return "other";
}

export function mediaPlayHref(file: FileLike): string {
  const params = new URLSearchParams({ path: file.key });

  if (typeof file.store === "string" && file.store) {
    params.set("disk", file.store);
  }

  return `/media/play?${params.toString()}`;
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "-";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

export function formatDate(value: string | undefined, locale: "ar" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "en" ? "en-US" : "ar-SA");
}

export function getUniqueStores(files: ArchiveFile[]) {
  return Array.from(new Set(files.map((file) => file.store).filter((store): store is string => Boolean(store)))).sort((a, b) =>
    a.localeCompare(b, "ar")
  );
}

export function getFileName(file: ArchiveFile) {
  return file.name || file.key.split(/[\\/]/).pop() || file.key;
}
