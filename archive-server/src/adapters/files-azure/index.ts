import { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions } from "@azure/storage-blob";

// Azure Blob Storage FileStore adapter — implements the @archive/core FileStore
// port against an Azure Blob container (Microsoft's object storage), selected
// via FILE_STORE=azure. Flat blob namespace maps cleanly to the key→blob port,
// like the S3 adapter. Credentials stay server-side; the SPA keeps talking to
// /api/files/*. The container client is injectable so the adapter is unit-tested
// without the network.

class AzureFileError extends Error {
  statusCode: number;

  constructor(message: string, { statusCode = 502 } = {}) {
    super(message);
    this.name = "AzureFileError";
    this.statusCode = statusCode;
  }
}

interface ContainerClient {
  listBlobsFlat(opts?: Record<string, unknown>): AsyncIterable<{ name: string }>;
  getBlockBlobClient(name: string): BlockBlobClient;
}

interface BlockBlobClient {
  uploadData(data: Buffer, opts?: Record<string, unknown>): Promise<unknown>;
  downloadToBuffer(): Promise<Buffer>;
  deleteIfExists(): Promise<unknown>;
  generateSasUrl(opts: Record<string, unknown>): Promise<string>;
  url?: string;
}

interface BlobMeta {
  contentType?: string;
  ContentType?: string;
}

interface BlobResult {
  key: string;
  url: string;
}

/** Join an optional prefix with a FileStore key → a blob name (traversal-safe). */
export function azureBlobName(prefix: string | undefined, key: string | number): string {
  const clean = String(key || "").replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) {
    throw new AzureFileError("Invalid file key.", { statusCode: 400 });
  }
  const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  return base ? `${base}/${clean}` : clean;
}

/** Strip the configured prefix off a blob name → relative FileStore key. */
export function stripAzurePrefix(prefix: string | undefined, blobName: string | undefined): string {
  const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  const full = String(blobName || "");
  if (!base) return full;
  return full.startsWith(`${base}/`) ? full.slice(base.length + 1) : full;
}

function isNotFound(error: unknown): boolean {
  const e = error as Record<string, unknown>;
  return e?.statusCode === 404 || e?.code === "BlobNotFound" || /BlobNotFound/.test(String(e?.message || ""));
}

async function toBytes(blob: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof (blob as Record<string, unknown>).arrayBuffer === "function") return Buffer.from(await ((blob as Record<string, unknown>).arrayBuffer as () => Promise<ArrayBuffer>)());
  return Buffer.alloc(0);
}

/** Build a ContainerClient from env-style credentials (connection string / key / SAS). */
function buildContainerClient({
  connectionString,
  container,
  accountName,
  accountKey,
  accountUrl,
  sasToken
}: Record<string, string | undefined>): ContainerClient {
  if (!container) throw new Error("Azure file store needs AZURE_STORAGE_CONTAINER.");
  if (connectionString) {
    return BlobServiceClient.fromConnectionString(connectionString).getContainerClient(container);
  }
  if (accountName && accountKey) {
    const cred = new StorageSharedKeyCredential(accountName, accountKey);
    return new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, cred).getContainerClient(container);
  }
  if (accountUrl && sasToken) {
    const url = `${accountUrl.replace(/\/+$/, "")}?${sasToken.replace(/^\?/, "")}`;
    return new BlobServiceClient(url).getContainerClient(container);
  }
  throw new Error("Azure file store needs AZURE_STORAGE_CONNECTION_STRING (or account name+key, or account URL+SAS).");
}

interface AzureOptions {
  containerClient?: ContainerClient;
  connectionString?: string;
  container?: string;
  accountName?: string;
  accountKey?: string;
  accountUrl?: string;
  sasToken?: string;
  prefix?: string;
  urlExpiresIn?: number;
}

export function createAzureBlobFileStore({
  containerClient,
  connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING,
  container = process.env.AZURE_STORAGE_CONTAINER,
  accountName = process.env.AZURE_STORAGE_ACCOUNT,
  accountKey = process.env.AZURE_STORAGE_KEY,
  accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL,
  sasToken = process.env.AZURE_STORAGE_SAS,
  prefix = process.env.AZURE_STORAGE_PREFIX || "",
  urlExpiresIn = Number(process.env.AZURE_URL_EXPIRES_IN) || 3600
}: AzureOptions = {}) {
  const cc = containerClient || buildContainerClient({ connectionString, container, accountName, accountKey, accountUrl, sasToken });

  return {
    describe() {
      return {
        kind: "azure",
        label: "Azure Blob",
        container,
        prefix,
        configured: Boolean(container),
        auth: connectionString ? "connection-string" : accountKey ? "account-key" : sasToken ? "sas" : "injected-client"
      };
    },
    async putBlob(key: string | number, blob: unknown, meta: BlobMeta = {}): Promise<BlobResult> {
      const name = azureBlobName(prefix as string | undefined, key);
      const bytes = await toBytes(blob);
      const blockBlob = cc.getBlockBlobClient(name);
      const contentType = (meta.contentType || meta.ContentType || "") as string;
      await blockBlob.uploadData(bytes, contentType ? { blobHTTPHeaders: { blobContentType: contentType } } : {});
      const clean = String(key || "").replace(/^[/\\]+/, "");
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },

    async getBlob(key: string | number): Promise<Buffer | null> {
      const name = azureBlobName(prefix as string | undefined, key);
      try {
        return await cc.getBlockBlobClient(name).downloadToBuffer();
      } catch (error) {
        if (isNotFound(error)) return null;
        throw new AzureFileError(`Azure download failed: ${(error as Record<string, unknown>)?.message || (error as Record<string, unknown>)?.code}`);
      }
    },

    async getUrl(key: string | number): Promise<string | null> {
      const name = azureBlobName(prefix as string | undefined, key);
      const blockBlob = cc.getBlockBlobClient(name);
      try {
        // Works when the client carries a shared-key credential; otherwise the
        // SDK throws and we fall back to the plain blob URL.
        return await blockBlob.generateSasUrl({
          permissions: BlobSASPermissions.parse("r"),
          expiresOn: new Date(Date.now() + (urlExpiresIn as number) * 1000)
        });
      } catch {
        return blockBlob.url || null;
      }
    },

    async remove(key: string | number): Promise<void> {
      const name = azureBlobName(prefix as string | undefined, key);
      await cc.getBlockBlobClient(name).deleteIfExists(); // idempotent
    },

    async list(listPrefix: string = ""): Promise<string[]> {
      const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
      const userPrefix = String(listPrefix || "").replace(/^[/\\]+/, "");
      const fullPrefix = [base, userPrefix].filter(Boolean).join("/");
      const keys: string[] = [];
      for await (const blob of cc.listBlobsFlat(fullPrefix ? { prefix: fullPrefix } : {})) {
        const rel = stripAzurePrefix(base, blob?.name);
        if (rel) keys.push(rel);
      }
      return keys;
    }
  };
}
