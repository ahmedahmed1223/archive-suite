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
import { createAiProvider } from "../ai/createAiProvider.js";
import { resolveServerConfig } from "../config/serverConfig.js";
import { normalizeDatabaseEngine } from "../config/secrets.js";

// Pick the FileStore backend behind /api/files/*. Selected by FILE_STORE:
//   disk    (default) — local disk (FILE_STORE_DIR).
//   dropbox           — Dropbox app folder (DROPBOX_*).
//   s3                — any S3-compatible store (Amazon S3, Cloudflare R2,
//                       Backblaze B2, DigitalOcean Spaces, Wasabi, MinIO,
//                       Google Cloud Storage via S3 interop) — see S3_* env.
//   azure             — Azure Blob Storage (Microsoft) — see AZURE_STORAGE_* env.
//   gdrive            — Google Drive folder (service account) — see GDRIVE_* env.
// Exported so it can be unit-tested in isolation.
export function buildFileStore(options = {}) {
  const config = typeof options.resolveConfig === "function" ? options.resolveConfig() : resolveServerConfig();
  const choice = (options.fileStore || config.fileStore || process.env.FILE_STORE || "disk").toLowerCase();
  if (choice === "dropbox") {
    return createDropboxFileStore({
      accessToken: options.dropboxAccessToken || config.dropboxAccessToken || process.env.DROPBOX_ACCESS_TOKEN,
      accessTokenExpiresAt: options.dropboxAccessTokenExpiresAt || config.dropboxAccessTokenExpiresAt || process.env.DROPBOX_ACCESS_TOKEN_EXPIRES_AT,
      refreshToken: options.dropboxRefreshToken || config.dropboxRefreshToken || process.env.DROPBOX_REFRESH_TOKEN,
      appKey: options.dropboxAppKey || config.dropboxAppKey || process.env.DROPBOX_APP_KEY,
      appSecret: options.dropboxAppSecret || config.dropboxAppSecret || process.env.DROPBOX_APP_SECRET,
      rootPath: options.dropboxRootPath || config.dropboxRootPath || process.env.DROPBOX_ROOT_PATH,
      selectUser: options.dropboxSelectUser || config.dropboxSelectUser || process.env.DROPBOX_SELECT_USER,
      selectAdmin: options.dropboxSelectAdmin || config.dropboxSelectAdmin || process.env.DROPBOX_SELECT_ADMIN
    });
  }
  if (choice === "s3") {
    return createS3FileStore({}); // reads S3_* from env
  }
  if (choice === "azure") {
    return createAzureBlobFileStore({}); // reads AZURE_STORAGE_* from env
  }
  if (choice === "gdrive") {
    return createGoogleDriveFileStore({}); // reads GDRIVE_* from env
  }
  return createDiskFileStore({ rootDir: options.fileStoreDir || config.fileStoreDir || process.env.FILE_STORE_DIR });
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
//
// Defaults to pocketbase for backward compatibility with the v0.1 deploy.
export function registerCloudProviders(options = {}) {
  const backend = options.backend || process.env.BACKEND || "pocketbase";
  const config = typeof options.resolveConfig === "function" ? options.resolveConfig() : resolveServerConfig();
  const wireAdditionalPorts = (provider) => {
    const files = buildFileStore(options);
    const sync = createCloudSyncProvider({ storageProvider: provider });
    registerFileStore(files);
    registerSyncProvider(sync);
    // AI is optional — registered only when a provider+key is configured.
    // Keys stay server-side (env), proxied to the SPA via /api/ai/*.
    const aiProviderId = options.aiProvider || process.env.AI_PROVIDER;
    const aiApiKey = options.aiApiKey || process.env.AI_API_KEY;
    // Transcription is independent: it may run even without a chat provider
    // (e.g. transcribe-only deployment), and vice versa.
    const transcribeProviderId = options.transcribeProvider || process.env.TRANSCRIBE_PROVIDER;
    const transcribe = transcribeProviderId ? {
      provider: transcribeProviderId,
      apiKey: options.transcribeApiKey || process.env.TRANSCRIBE_API_KEY,
      model: options.transcribeModel || process.env.TRANSCRIBE_MODEL,
      baseUrl: options.transcribeBaseUrl || process.env.TRANSCRIBE_BASE_URL
    } : undefined;
    let ai = null;
    const hasChat = aiProviderId && (aiApiKey || aiProviderId === "ollama");
    if (hasChat || transcribe) {
      ai = createAiProvider({
        // A chat provider is optional when only transcription is configured;
        // default to openrouter so the SDK builds, but chat calls will surface
        // "not configured" if no key — transcription works regardless.
        provider: aiProviderId || "openrouter",
        apiKey: aiApiKey,
        model: options.aiModel || process.env.AI_MODEL,
        baseUrl: options.aiBaseUrl || process.env.AI_BASE_URL,
        impl: options.aiImpl || process.env.AI_IMPL,
        transcribe,
        appTitle: "Video Archive"
      });
      registerAiProvider(ai);
    }
    return { files, sync, ai };
  };

  if (backend === "postgres") {
    if (!options.prisma) {
      throw new Error(
        "Postgres backend requires `options.prisma` — instantiate PrismaClient in your app entry and pass it in."
      );
    }
    const provider = createPostgresStorageProvider(options.prisma);
    registerStorageProvider(provider);
    const engine = normalizeDatabaseEngine(options.databaseEngine || config.databaseEngine || process.env.DATABASE_PROVIDER);
    return { backend, engine, provider, prisma: options.prisma, ...wireAdditionalPorts(provider) };
  }

  if (backend === "pocketbase") {
    const url = options.url || process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
    const client = new PocketBase(url);
    const provider = createPocketBaseStorageProvider(client);
    registerStorageProvider(provider);
    return { backend, engine: "pocketbase", provider, client, ...wireAdditionalPorts(provider) };
  }

  throw new Error(`Unknown backend "${backend}" — expected "postgres" or "pocketbase".`);
}
