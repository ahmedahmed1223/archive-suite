import {
  createLocalFileValue,
  createVideoItemValue
} from "../videos/viewModel.js";

export const VIDEO_IMPORT_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "m4v", "avi", "mkv", "wmv"]);

export function getFileExtension(name = "") {
  const value = String(name || "");
  return value.includes(".") ? value.split(".").pop().toLowerCase() : "";
}

export function isLikelyVideoFile(file) {
  if (!file) return false;
  if (String(file.type || "").startsWith("video/")) return true;
  return VIDEO_IMPORT_EXTENSIONS.has(getFileExtension(file.name));
}

function createImportFingerprint(title = "", path = "") {
  return [title, path]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

export function createFileImportRows(files = [], existingItems = []) {
  const existingFingerprints = new Set(existingItems.map((item) => createImportFingerprint(
    item.title,
    item.path || item.filePath || item.url
  )));

  return Array.from(files || [])
    .filter(isLikelyVideoFile)
    .map((file, index) => {
      const localFile = createLocalFileValue(file);
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

export function createImportedVideoItem(row, {
  typeId = "",
  subtypeId = "",
  notes = ""
} = {}) {
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
