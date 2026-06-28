import {
  createLocalFileValue,
  createVideoItemValue
} from "../videos/viewModel.js";

export interface FileImportLocalFile {
  relativePath?: string;
  path?: string;
  extension?: string;
}

export interface FileImportRow {
  id: string;
  file?: File;
  title?: string;
  path?: string;
  localFile?: FileImportLocalFile | null;
  duplicate?: boolean;
  selected?: boolean;
}

export const VIDEO_IMPORT_EXTENSIONS: ReadonlySet<string> = new Set(["mp4", "webm", "ogg", "mov", "m4v", "avi", "mkv", "wmv"]);

export function getFileExtension(name = ""): string {
  const value = String(name || "");
  return value.includes(".") ? (value.split(".").pop() || "").toLowerCase() : "";
}

export function isLikelyVideoFile(file: File | null | undefined): boolean {
  if (!file) return false;
  if (String(file.type || "").startsWith("video/")) return true;
  return VIDEO_IMPORT_EXTENSIONS.has(getFileExtension(file.name));
}

function createImportFingerprint(title = "", path = ""): string {
  return [title, path]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

export function createFileImportRows(files: File[] = [], existingItems: Array<{ title?: unknown; path?: unknown; filePath?: unknown; url?: unknown }> = []): FileImportRow[] {
  const existingFingerprints = new Set(existingItems.map((item) => createImportFingerprint(
    String(item.title || ""),
    String(item.path || item.filePath || item.url || "")
  )));

  return Array.from(files || [])
    .filter(isLikelyVideoFile)
    .map((file, index) => {
      const localFile = createLocalFileValue(file) as FileImportLocalFile | null | undefined;
      const title = String(file.name || "").replace(/\.[^.]+$/, "") || `فيديو ${index + 1}`;
      const path = localFile?.relativePath || localFile?.path || file.name || "";
      const fingerprint = createImportFingerprint(title, path);
      const duplicate = existingFingerprints.has(fingerprint);

      return {
        id: `${file.name || "file"}-${file.size || 0}-${file.lastModified || 0}-${index}`,
        file,
        title,
        path,
        localFile,
        duplicate,
        selected: !duplicate
      };
    });
}

export function createImportedVideoItem(row: FileImportRow | null | undefined, {
  typeId = "",
  subtypeId = "",
  notes = ""
}: {
  typeId?: string;
  subtypeId?: string;
  notes?: string;
} = {}): unknown {
  return createVideoItemValue({
    title: row?.title,
    type: typeId,
    subtype: subtypeId,
    path: row?.path,
    notes,
    metadata: {
      localFile: row?.localFile || null,
      importedFrom: "fileArchiveWizard",
      importedAt: new Date().toISOString()
    },
    tags: row?.localFile?.extension ? [row.localFile.extension] : []
  });
}
