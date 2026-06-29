interface FileStoreProvider {
  id: string;
  label: string;
  requiredEnv?: string[];
  requiredAny?: string[][];
}

interface FileStoreProviderStatus {
  id: string;
  label: string;
  configured: boolean;
  active: boolean;
  missingEnv: string[];
}

export const FILE_STORE_PROVIDERS: readonly FileStoreProvider[] = Object.freeze([
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

function isSet(env: Record<string, unknown> | undefined, name: string): boolean {
  return Boolean(String(env?.[name] || "").trim());
}

export function resolveFileStoreProviderStatuses(env: Record<string, unknown> = process.env, active: string = (env.FILE_STORE as string) || "disk"): FileStoreProviderStatus[] {
  return FILE_STORE_PROVIDERS.map((provider) => {
    const missingEnv: string[] = (provider.requiredEnv || []).filter((name) => !isSet(env, name));
    const alternatives = provider.requiredAny || [];
    const anyReady = alternatives.length === 0 || alternatives.some((group) => group.every((name) => isSet(env, name)));
    if (!anyReady) {
      const shortest = [...alternatives].sort((a, b) => a.length - b.length)[0] || [];
      for (const name of shortest) if (!isSet(env, name) && !missingEnv.includes(name)) missingEnv.push(name);
    }
    return {
      id: provider.id,
      label: provider.label,
      configured: missingEnv.length === 0,
      active: provider.id === active,
      missingEnv
    };
  });
}
