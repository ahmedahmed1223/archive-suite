export const ONBOARDING_CONFIG = Object.freeze({
  backend: "BACKEND",
  serverUrl: "APP_BASE_URL",
  adminUsername: "ADMIN_USERNAME",
  adminPassword: "ADMIN_PASSWORD",
  authSecrets: ["JWT_AUTH_SECRET", "JWT_SECRET"],
  fileStore: "FILE_STORE"
});

export const ONBOARDING_FILE_STORE_PROVIDERS = Object.freeze([
  { id: "disk", label: "Disk / mounted folder", requiredEnv: [] },
  { id: "s3", label: "S3-compatible", requiredEnv: ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] },
  { id: "dropbox", label: "Dropbox", requiredAny: [["DROPBOX_ACCESS_TOKEN"], ["DROPBOX_REFRESH_TOKEN", "DROPBOX_APP_KEY", "DROPBOX_APP_SECRET"]] },
  { id: "azure", label: "Azure Blob Storage", requiredAny: [["AZURE_STORAGE_CONNECTION_STRING", "AZURE_STORAGE_CONTAINER"], ["AZURE_STORAGE_ACCOUNT", "AZURE_STORAGE_KEY", "AZURE_STORAGE_CONTAINER"]] },
  { id: "gdrive", label: "Google Drive", requiredEnv: ["GDRIVE_FOLDER_ID", "GDRIVE_CREDENTIALS"] },
  { id: "ftp", label: "FTP / FTPS", requiredEnv: ["FTP_HOST", "FTP_USER"] },
  { id: "smb", label: "SMB / CIFS", requiredEnv: ["SMB_SHARE", "SMB_USERNAME"] },
  { id: "sftp", label: "SFTP / SSH", requiredEnv: ["SFTP_HOST", "SFTP_USERNAME"], requiredAny: [["SFTP_PASSWORD"], ["SFTP_PRIVATE_KEY"]] },
  { id: "webdav", label: "WebDAV", requiredEnv: ["WEBDAV_URL"], requiredAny: [[], ["WEBDAV_USERNAME", "WEBDAV_PASSWORD"], ["WEBDAV_BEARER_TOKEN"]] }
]);
