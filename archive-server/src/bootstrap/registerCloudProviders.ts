import PocketBase from "pocketbase";
import { registerAiProvider, registerFileStore, registerStorageProvider, registerSyncProvider } from "@archive/core";
import { createPocketBaseStorageProvider } from "../adapters/cloud-pocketbase/storage.js";
import { createPostgresStorageProvider } from "../adapters/cloud-postgres-prisma/storage.js";
import { createCloudSyncProvider } from "../adapters/cloud-sync/index.js";
import { createDiskFileStore } from "../adapters/files-disk/index.js";
import { createDropboxFileStore } from "../adapters/files-dropbox/index.js";
import { createS3FileStore } from "../adapters/files-s3/index.js";
import { createAzureBlobFileStore } from "../adapters/files-azure/index.js";
import { createGoogleDriveFileStore } from "../adapters/files-gdrive/index.js";
import { createFtpFileStore } from "../adapters/files-ftp/index.js";
import { createSmbFileStore } from "../adapters/files-smb/index.js";
import { createSftpFileStore } from "../adapters/files-sftp/index.js";
import { createWebDavFileStore } from "../adapters/files-webdav/index.js";
import { createAiProvider } from "../ai/createAiProvider.js";
import { resolveServerConfig } from "../config/serverConfig.js";
import { normalizeDatabaseEngine } from "../config/secrets.js";
import { config as envConfig } from "../config/env.js";

interface BuildFileStoreOptions {
  resolveConfig?: () => unknown;
  fileStore?: string;
  fileStoreOptions?: Record<string, unknown>;
  dropboxAccessToken?: string;
  dropboxAccessTokenExpiresAt?: string;
  dropboxRefreshToken?: string;
  dropboxAppKey?: string;
  dropboxAppSecret?: string;
  dropboxRootPath?: string;
  dropboxSelectUser?: string;
  dropboxSelectAdmin?: string;
  fileStoreDir?: string;
}

interface RegisterCloudProvidersOptions extends BuildFileStoreOptions {
  backend?: string;
  aiProvider?: string;
  aiApiKey?: string;
  transcribeProvider?: string;
  transcribeApiKey?: string;
  transcribeModel?: string;
  transcribeBaseUrl?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  aiImpl?: string;
  prisma?: unknown;
  databaseEngine?: string;
  url?: string;
}

interface TranscribeConfig {
  provider: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

interface RegisterResult {
  backend: string;
  engine: string;
  provider: unknown;
  client?: PocketBase;
  prisma?: unknown;
  files: unknown;
  sync: unknown;
  ai: unknown;
}

// Pick the FileStore backend behind /api/files/*. Selected by FILE_STORE:
//   disk    (default) — local disk (FILE_STORE_DIR).
//   dropbox           — Dropbox app folder (DROPBOX_*).
//   s3                — any S3-compatible store (Amazon S3, Cloudflare R2,
//                       Backblaze B2, DigitalOcean Spaces, Wasabi, MinIO,
//                       Google Cloud Storage via S3 interop) — see S3_* env.
//   azure             — Azure Blob Storage (Microsoft) — see AZURE_STORAGE_* env.
//   gdrive            — Google Drive folder (service account) — see GDRIVE_* env.
// Exported so it can be unit-tested in isolation.
export function buildFileStore(options: BuildFileStoreOptions = {}) {
  const config = typeof options.resolveConfig === "function" ? options.resolveConfig() : resolveServerConfig();
  const choice = (options.fileStore || (config as any).fileStore || envConfig.fileStore).toLowerCase();
  const providerOptions = options.fileStoreOptions || (config as any).fileStoreOptions || {};
  if (choice === "dropbox") {
    return createDropboxFileStore({
      accessToken: options.dropboxAccessToken || (config as any).dropboxAccessToken,
      accessTokenExpiresAt: options.dropboxAccessTokenExpiresAt || (config as any).dropboxAccessTokenExpiresAt,
      refreshToken: options.dropboxRefreshToken || (config as any).dropboxRefreshToken,
      appKey: options.dropboxAppKey || (config as any).dropboxAppKey,
      appSecret: options.dropboxAppSecret || (config as any).dropboxAppSecret,
      rootPath: options.dropboxRootPath || (config as any).dropboxRootPath,
      selectUser: options.dropboxSelectUser || (config as any).dropboxSelectUser,
      selectAdmin: options.dropboxSelectAdmin || (config as any).dropboxSelectAdmin
    } as any);
  }
  if (choice === "s3") {
    return createS3FileStore(providerOptions);
  }
  if (choice === "azure") {
    return createAzureBlobFileStore(providerOptions);
  }
  if (choice === "gdrive") {
    return createGoogleDriveFileStore(providerOptions);
  }
  if (choice === "ftp") {
    return createFtpFileStore(providerOptions);
  }
  if (choice === "smb") {
    return createSmbFileStore(providerOptions);
  }
  if (choice === "sftp") {
    return createSftpFileStore(providerOptions);
  }
  if (choice === "webdav") {
    return createWebDavFileStore(providerOptions);
  }
  return createDiskFileStore({ rootDir: options.fileStoreDir || (providerOptions as any).rootDir || (config as any).fileStoreDir || envConfig.fileStoreDir });
}

// The cloud (server) boot seam — symmetric with the SPA's registerLocalProviders.
// Routes between two backends without leaking either choice into the rest of
// the codebase: the registry only sees a StorageProvider, never the concrete
// client.
//
// backend = "pocketbase" → builds a PocketBase client and uses cloud-pocketbase
// backend = "postgres"   → expects a pre-built Prisma client (caller controls
//                          its lifecycle so tests can inject a fake) and uses
//                          cloud-postgres-prisma
// backend = "sqlserver"  → same Prisma-backed storage port as postgres; the
//                          generated Prisma provider/driver is selected at
//                          deploy time by DATABASE_PROVIDER.
//
// Defaults to pocketbase for backward compatibility with the v0.1 deploy.
export function registerCloudProviders(options: RegisterCloudProvidersOptions = {}): RegisterResult {
  const backend = options.backend || envConfig.backend;
  const config = typeof options.resolveConfig === "function" ? options.resolveConfig() : resolveServerConfig();
  const wireAdditionalPorts = (provider: unknown) => {
    const files = buildFileStore(options);
    const sync = createCloudSyncProvider({ storageProvider: provider as any });
    registerFileStore(files);
    registerSyncProvider(sync);
    // AI is optional — registered only when a provider+key is configured.
    // Keys stay server-side (env), proxied to the SPA via /api/ai/*.
    const aiProviderId = options.aiProvider || envConfig.aiProvider;
    const aiApiKey = options.aiApiKey || envConfig.aiApiKey;
    // Transcription is independent: it may run even without a chat provider
    // (e.g. transcribe-only deployment), and vice versa.
    const transcribeProviderId = options.transcribeProvider || envConfig.transcribeProvider;
    const transcribe: TranscribeConfig | undefined = transcribeProviderId ? {
      provider: transcribeProviderId,
      apiKey: options.transcribeApiKey || envConfig.transcribeApiKey,
      model: options.transcribeModel || envConfig.transcribeModel,
      baseUrl: options.transcribeBaseUrl || envConfig.transcribeBaseUrl
    } : undefined;
    let ai: unknown = null;
    const hasChat = aiProviderId && (aiApiKey || aiProviderId === "ollama");
    if (hasChat || transcribe) {
      ai = createAiProvider({
        // A chat provider is optional when only transcription is configured;
        // default to openrouter so the SDK builds, but chat calls will surface
        // "not configured" if no key — transcription works regardless.
        provider: aiProviderId || "openrouter",
        apiKey: aiApiKey,
        model: options.aiModel || envConfig.aiModel,
        baseUrl: options.aiBaseUrl || envConfig.aiBaseUrl,
        impl: options.aiImpl || envConfig.aiImpl,
        transcribe
      });
      registerAiProvider(ai);
    }
    return { files, sync, ai };
  };

  if (backend === "postgres" || backend === "sqlserver") {
    if (!options.prisma) {
      throw new Error(
        "Prisma SQL backend requires `options.prisma` — instantiate PrismaClient in your app entry and pass it in."
      );
    }
    const provider = createPostgresStorageProvider(options.prisma as any);
    registerStorageProvider(provider);
    const engine = normalizeDatabaseEngine(options.databaseEngine || (config as any).databaseEngine);
    return { backend, engine, provider, prisma: options.prisma, ...wireAdditionalPorts(provider) };
  }

  if (backend === "pocketbase") {
    const url = options.url || envConfig.pocketbaseUrl;
    const client = new PocketBase(url);
    const provider = createPocketBaseStorageProvider(client as any);
    registerStorageProvider(provider);
    return { backend, engine: "pocketbase", provider, client, ...wireAdditionalPorts(provider) };
  }

  throw new Error(`Unknown backend "${backend}" — expected "postgres", "sqlserver", or "pocketbase".`);
}
