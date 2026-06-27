export type ServerBackendEngine =
  | "postgresql"
  | "postgres"
  | "mysql"
  | "sqlite"
  | "sqlserver";

export type FileStoreKind =
  | "disk"
  | "dropbox"
  | "s3"
  | "azure"
  | "gdrive"
  | "ftp"
  | "smb"
  | "sftp"
  | "webdav";

export type AuthRole = "admin" | "editor" | "viewer" | "owner";

export interface ServerHealthSummary {
  ok: boolean;
  backend?: string;
  engine?: ServerBackendEngine | string;
  uptimeSec?: number;
  version?: string;
  authRequired?: boolean;
  db?: {
    ok: boolean;
    latencyMs?: number;
    error?: string;
  };
}
