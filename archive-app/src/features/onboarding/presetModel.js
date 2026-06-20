const CLOUD_BACKENDS = new Set(["postgres", "pocketbase"]);
const FILE_STORE_KINDS = new Set(["disk", "s3", "dropbox", "azure", "gdrive", "ftp", "smb", "sftp", "webdav"]);

export const DEFAULT_FILE_STORE_PROVIDERS = Object.freeze([
  ["disk", "قرص الخادم / مجلد مركب"],
  ["s3", "S3-compatible"],
  ["dropbox", "Dropbox"],
  ["azure", "Azure Blob Storage"],
  ["gdrive", "Google Drive"],
  ["ftp", "FTP / FTPS"],
  ["smb", "SMB / CIFS"],
  ["sftp", "SFTP / SSH"],
  ["webdav", "WebDAV"]
].map(([id, label]) => Object.freeze({ id, label, configured: id === "disk", active: id === "disk", missingEnv: [] })));

export function createPresetFormState(preset = {}) {
  const backend = CLOUD_BACKENDS.has(preset?.backend) ? preset.backend : "local";
  const fileStore = FILE_STORE_KINDS.has(preset?.fileStore?.active) ? preset.fileStore.active : "disk";
  return {
    storageChoice: backend,
    storageUrl: String(preset?.serverUrl || ""),
    cloudUsername: String(preset?.adminUsername || "admin"),
    cloudPassword: String(preset?.adminPassword || ""),
    fileStoreChoice: fileStore
  };
}

export function selectBackendPreset(preset = {}, backend = "local") {
  return {
    ...createPresetFormState(preset),
    storageChoice: CLOUD_BACKENDS.has(backend) ? backend : "local"
  };
}
