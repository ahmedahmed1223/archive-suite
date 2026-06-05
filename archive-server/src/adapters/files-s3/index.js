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
  constructor(message, { statusCode = 502 } = {}) {
    super(message);
    this.name = "S3FileError";
    this.statusCode = statusCode;
  }
}

/** Join an optional key prefix with a FileStore key (traversal-safe, "/"-normalized). */
export function s3Key(prefix, key) {
  const clean = String(key || "").replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) {
    throw new S3FileError("Invalid file key.", { statusCode: 400 });
  }
  const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  return base ? `${base}/${clean}` : clean;
}

/** Strip the configured prefix back off an absolute object key → relative key. */
export function stripPrefix(prefix, objectKey) {
  const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
  const full = String(objectKey || "");
  if (!base) return full;
  return full.startsWith(`${base}/`) ? full.slice(base.length + 1) : full;
}

function isNotFound(error) {
  const code = error?.$metadata?.httpStatusCode;
  return error?.name === "NoSuchKey" || error?.name === "NotFound" || code === 404;
}

async function toBytes(blob) {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof blob.arrayBuffer === "function") return Buffer.from(await blob.arrayBuffer());
  return Buffer.alloc(0);
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
  urlExpiresIn = Number(process.env.S3_URL_EXPIRES_IN) || 3600,
  presign = getSignedUrl
} = {}) {
  if (!bucket) throw new Error("S3 file store needs S3_BUCKET.");
  const s3 = client || new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: accessKeyId ? { accessKeyId, secretAccessKey } : undefined
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
    async putBlob(key, blob, meta = {}) {
      const Key = s3Key(prefix, key);
      const Body = await toBytes(blob);
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key, Body,
        ContentType: meta.contentType || meta.ContentType || undefined
      }));
      const clean = String(key || "").replace(/^[/\\]+/, "");
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },

    async getBlob(key) {
      const Key = s3Key(prefix, key);
      try {
        const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key }));
        if (!out?.Body) return null;
        // AWS SDK v3 stream → bytes (Node + browser runtimes both expose this).
        return Buffer.from(await out.Body.transformToByteArray());
      } catch (error) {
        if (isNotFound(error)) return null;
        throw new S3FileError(`S3 download failed: ${error?.message || error?.name}`);
      }
    },

    async getUrl(key) {
      const Key = s3Key(prefix, key);
      try {
        return await presign(s3, new GetObjectCommand({ Bucket: bucket, Key }), { expiresIn: urlExpiresIn });
      } catch {
        return null; // displayable URL is best-effort
      }
    },

    async remove(key) {
      const Key = s3Key(prefix, key);
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key })); // S3 delete is idempotent
    },

    async list(listPrefix = "") {
      const base = String(prefix || "").replace(/^[/\\]+|[/\\]+$/g, "");
      const userPrefix = String(listPrefix || "").replace(/^[/\\]+/, "");
      const Prefix = [base, userPrefix].filter(Boolean).join("/");
      const keys = [];
      let ContinuationToken;
      for (let guard = 0; guard < 10_000; guard += 1) {
        const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: Prefix || undefined, ContinuationToken, MaxKeys: 1000 }));
        for (const obj of Array.isArray(out?.Contents) ? out.Contents : []) {
          const rel = stripPrefix(base, obj.Key);
          if (rel) keys.push(rel);
        }
        if (!out?.IsTruncated) break;
        ContinuationToken = out.NextContinuationToken;
        if (!ContinuationToken) break;
      }
      return keys;
    }
  };
}
