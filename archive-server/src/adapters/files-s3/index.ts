import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3-compatible FileStore adapter — implements the @archive/core FileStore port
// against any S3 API. One adapter covers a wide range of providers via the
// `endpoint` + `forcePathStyle` knobs:
//   • Amazon S3            (no endpoint, region set)
//   • Cloudflare R2        (endpoint https://<acct>.r2.cloudflarestorage.com)
//   • Backblaze B2         (S3 endpoint, region from bucket)
//   • DigitalOcean Spaces  (endpoint https://<region>.digitaloceanspaces.com)
//   • Wasabi               (endpoint https://s3.<region>.wasabisys.com)
//   • MinIO / self-hosted  (endpoint http(s)://host:9000, forcePathStyle=true)
//   • Google Cloud Storage (endpoint https://storage.googleapis.com — S3 interop)
//
// Credentials stay server-side (env). The SPA keeps talking to /api/files/*;
// putBlob returns the same server-relative url so nothing downstream changes.

class S3FileError extends Error {
  statusCode: number;

  constructor(message: string, { statusCode = 502 }: { statusCode?: number } = {}) {
    super(message);
    this.name = "S3FileError";
    this.statusCode = statusCode;
  }
}

interface BlobResult {
  key: string;
  url: string;
}

type PresignFn = (client: unknown, command: unknown, opts: Record<string, unknown>) => Promise<string>;

/** Join an optional key prefix with a FileStore key (traversal-safe, "/"-normalized). */
export function s3Key(prefix: string | undefined, key: string | number): string {
  const clean = String(key || "").replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) {
    throw new S3FileError("Invalid file key.", { statusCode: 400 });
  }
  const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  return base ? `${base}/${clean}` : clean;
}

/** Strip the configured prefix back off an absolute object key → relative key. */
export function stripPrefix(prefix: string | undefined, objectKey: string | undefined): string {
  const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  const full = String(objectKey || "");
  if (!base) return full;
  return full.startsWith(`${base}/`) ? full.slice(base.length + 1) : full;
}

function isNotFound(error: unknown): boolean {
  const e = error as Record<string, unknown>;
  const code = (e?.$metadata as Record<string, unknown>)?.httpStatusCode;
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || code === 404;
}

async function toBytes(blob: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof (blob as Record<string, unknown>).arrayBuffer === "function") return Buffer.from(await ((blob as Record<string, unknown>).arrayBuffer as () => Promise<ArrayBuffer>)());
  return Buffer.alloc(0);
}

interface S3Options {
  client?: S3Client;
  bucket?: string;
  prefix?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  urlExpiresIn?: number | unknown;
  presign?: (client: unknown, command: unknown, opts: Record<string, unknown>) => Promise<string>;
  [key: string]: unknown;
}

export function createS3FileStore({
  client,
  bucket = process.env.S3_BUCKET,
  prefix = process.env.S3_PREFIX || "",
  region = process.env.S3_REGION || "us-east-1",
  endpoint = process.env.S3_ENDPOINT || undefined,
  accessKeyId = process.env.S3_ACCESS_KEY_ID,
  secretAccessKey = process.env.S3_SECRET_ACCESS_KEY,
  forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || "") === "true",
  urlExpiresIn = 3600 as number,
  presign = getSignedUrl as unknown as S3Options["presign"]
}: S3Options = {}) {
  if (!bucket) throw new Error("S3 file store needs S3_BUCKET.");
  const s3 = client || new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined
  });

  return {
    describe() {
      return {
        kind: "s3",
        label: endpoint ? "S3-compatible" : "Amazon S3",
        bucket,
        prefix,
        configured: Boolean(bucket),
        auth: accessKeyId ? "access-key" : "default-chain"
      };
    },
    async putBlob(key: string | number, blob: unknown, meta: Record<string, string> = {}): Promise<BlobResult> {
      const Key = s3Key(prefix, key);
      const Body = await toBytes(blob);
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key, Body,
        ContentType: meta.contentType || meta.ContentType || undefined
      }));
      const clean = String(key || "").replace(/^[/\\]+/, "");
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },

    async getBlob(key: string | number): Promise<Buffer | null> {
      const Key = s3Key(prefix, key);
      try {
        const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key }));
        if (!out?.Body) return null;
        // AWS SDK v3 stream → bytes (Node + browser runtimes both expose this).
        const body = out.Body as unknown as Record<string, unknown>;
        return Buffer.from(await (body.transformToByteArray as () => Promise<Uint8Array>)());
      } catch (error) {
        if (isNotFound(error)) return null;
        throw new S3FileError(`S3 download failed: ${(error as Record<string, unknown>)?.message || (error as Record<string, unknown>)?.name}`);
      }
    },

    async getUrl(key: string | number): Promise<string | null> {
      const Key = s3Key(prefix, key);
      try {
        const presignFn = presign as any;
        return await presignFn(s3 as unknown, new GetObjectCommand({ Bucket: bucket, Key }), { expiresIn: urlExpiresIn });
      } catch {
        return null; // displayable URL is best-effort
      }
    },

    async remove(key: string | number): Promise<void> {
      const Key = s3Key(prefix, key);
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key })); // S3 delete is idempotent
    },

    async list(listPrefix: string = ""): Promise<string[]> {
      const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
      const userPrefix = String(listPrefix || "").replace(/^[/\\]+/, "");
      const Prefix = [base, userPrefix].filter(Boolean).join("/");
      const keys: string[] = [];
      let ContinuationToken: string | undefined;
      for (let guard = 0; guard < 10_000; guard += 1) {
        const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: Prefix || undefined, ContinuationToken, MaxKeys: 1000 }));
        for (const obj of Array.isArray(out?.Contents) ? out.Contents : []) {
          const rel = stripPrefix(base, (obj as Record<string, unknown>).Key as string);
          if (rel) keys.push(rel);
        }
        if (!out?.IsTruncated) break;
        ContinuationToken = out?.NextContinuationToken;
        if (!ContinuationToken) break;
      }
      return keys;
    }
  };
}
