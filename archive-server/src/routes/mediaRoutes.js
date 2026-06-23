// Media routes — probe, transcode, derivative (thumbnail/audio/preview), jobs,
// derived-files list, file browser, file upload/download/delete, chunked upload,
// image processing, project MP4 export.
// Extracted from api/server.js. No business logic changed.

import { logger } from "../logger.js";
import { auditLog } from "../api/auditLogger.js";
import { secureOverwrite } from "../retention/secureDelete.js";
import { processImage, detectImageMimeType, PROCESSABLE_IMAGE_TYPES } from "../media/imageProcessor.js";
import {
  copyEntry,
  createFolder,
  listEntries,
  moveEntry,
  normalizeFileKey,
  removeEntries,
} from "../files/fileStoreOperations.js";
import {
  initSession as initUploadSession,
  receiveChunk,
  completeSession as completeUploadSession,
  abortSession as abortUploadSession,
  sessionStatus as uploadSessionStatus,
  CHUNK_BYTES as UPLOAD_CHUNK_BYTES,
} from "../api/chunkedUpload.js";
import {
  notifyUploadComplete,
} from "../notifications/notificationService.js";
import {
  sendPushToUser,
} from "../notifications/webPushService.js";

const SAFE_FILE_INFO_KEYS = new Set([
  "kind", "label", "rootPath", "rootDir", "bucket", "container",
  "prefix", "configured", "auth", "accountMode", "selectUser", "selectAdmin",
]);

function safeFileStoreInfo(info = {}) {
  const out = {};
  if (!info || typeof info !== "object") return out;
  for (const [key, value] of Object.entries(info)) {
    if (!SAFE_FILE_INFO_KEYS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

async function buildFileStoreStatus(files) {
  const info = typeof files?.describe === "function" ? safeFileStoreInfo(files.describe()) : {};
  const capabilities = {
    upload: typeof files?.putBlob === "function",
    download: typeof files?.getBlob === "function",
    list: typeof files?.list === "function",
    remove: typeof files?.remove === "function",
    temporaryUrl: typeof files?.getUrl === "function",
  };
  const health = {};
  if (capabilities.list) {
    try {
      const listed = await files.list("");
      health.listOk = true;
      health.listCount = Array.isArray(listed) ? listed.length : 0;
    } catch (error) {
      health.listOk = false;
      health.error = error?.message || "File list failed";
    }
  }
  return {
    kind: info.kind || "unknown",
    label: info.label || info.kind || "FileStore",
    configured: info.configured !== undefined ? Boolean(info.configured) : true,
    ...info,
    capabilities,
    health,
  };
}

/**
 * Handles all media and file routes.
 * Returns true if the request was handled.
 */
export async function handleMediaRoute({
  req,
  res,
  url,
  requestUrl,
  send,
  overLimit,
  readJsonBody,
  readRawBody,
  requireAuth,
  requireEditor,
  requireAuthClaims,
  resolveFileStore,
  runMediaProbeImpl,
  runMediaDerivativeImpl,
  runExport,
  mediaRootDir,
  ffmpegPath,
  mediaJobStore,
  conversionSvc,
  getMediaWorker,
  prisma,
  notificationSendMail,
  clientIp,
  reqLog,
}) {
  // POST /api/media/probe
  if (req.method === "POST" && url.split("?")[0] === "/api/media/probe") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireEditor(req, res)) return true;
    try {
      const body = await readJsonBody(req);
      const result = await runMediaProbeImpl({ key: body?.key, fileStore: resolveFileStore() });
      return send(res, 200, { ok: true, result }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Media probe failed", code: error?.code }), true;
    }
  }

  // POST /api/media/thumbnail | /api/media/audio | /api/media/preview
  const derivativeRoutes = {
    "/api/media/thumbnail": "thumbnail",
    "/api/media/audio": "audio",
    "/api/media/preview": "preview",
  };
  if (req.method === "POST" && Object.hasOwn(derivativeRoutes, url.split("?")[0])) {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireEditor(req, res)) return true;
    try {
      const body = await readJsonBody(req);
      const { key, ...params } = body || {};
      const result = await runMediaDerivativeImpl({
        type: derivativeRoutes[url.split("?")[0]],
        key,
        params,
        fileStore: resolveFileStore(),
      });
      return send(res, 200, { ok: true, result }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Media operation failed", code: error?.code }), true;
    }
  }

  // POST /api/media/jobs — create a media job
  if (req.method === "POST" && url.split("?")[0] === "/api/media/jobs") {
    if (overLimit(res, "rpc", req)) return true;
    const user = requireEditor(req, res);
    if (!user) return true;
    try {
      const body = await readJsonBody(req);
      const type = body?.type === "montage" ? "montage" : "transcode";
      const sourceKey = body?.sourceKey || body?.key || "";
      if (type === "transcode" && !sourceKey) {
        return send(res, 400, { ok: false, error: "مفتاح الملف مطلوب لمهمة التحويل." }), true;
      }
      if (type === "montage" && !body?.timeline) {
        return send(res, 400, { ok: false, error: "حمولة timeline مطلوبة لمهمة المونتاج." }), true;
      }
      const { key, sourceKey: _sk, type: _t, ...params } = body || {};
      const job = mediaJobStore.create({
        type,
        sourceKey,
        params,
        requestedBy: user.sub || user.username || "",
      });
      conversionSvc
        .requestConversion({
          sourceItemId: params?.itemId ?? null,
          sourceKey,
          conversionType: params?.format || type,
          label: params?.outputLabel || type,
          jobId: job.id,
          createdBy: user.sub || user.username || "",
        })
        .catch(() => {});
      Promise.resolve(getMediaWorker().pump()).catch(() => {});
      return send(res, 200, { ok: true, result: { jobId: job.id, job } }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Media job failed" }), true;
    }
  }

  // GET /api/media/jobs — list jobs
  if (req.method === "GET" && url.split("?")[0] === "/api/media/jobs") {
    if (!requireEditor(req, res)) return true;
    return send(res, 200, { ok: true, result: mediaJobStore.list() }), true;
  }

  // /api/media/jobs/:id[/retry]
  if (url.split("?")[0].startsWith("/api/media/jobs/")) {
    const parts = url.split("?")[0].slice("/api/media/jobs/".length).split("/");
    const id = decodeURIComponent(parts[0] || "");
    if (!id) return send(res, 400, { ok: false, error: "معرّف المهمة مطلوب." }), true;
    if (req.method === "GET" && parts.length === 1) {
      if (!requireEditor(req, res)) return true;
      const job = mediaJobStore.get(id);
      return job
        ? (send(res, 200, { ok: true, result: job }), true)
        : (send(res, 404, { ok: false, error: "المهمة غير موجودة." }), true);
    }
    if (req.method === "POST" && parts[1] === "retry") {
      if (overLimit(res, "rpc", req)) return true;
      if (!requireEditor(req, res)) return true;
      const job = mediaJobStore.retry(id);
      if (!job) return send(res, 400, { ok: false, error: "لا يمكن إعادة محاولة هذه المهمة." }), true;
      Promise.resolve(getMediaWorker().pump()).catch(() => {});
      return send(res, 200, { ok: true, result: job }), true;
    }
  }

  // GET /api/media/derived
  if (req.method === "GET" && url.split("?")[0] === "/api/media/derived") {
    if (!requireAuth(req, res)) return true;
    const params = new URLSearchParams(url.includes("?") ? url.slice(url.indexOf("?") + 1) : "");
    const sourceItemId = params.get("sourceItemId") || "";
    const sourceKey = params.get("sourceKey") || "";
    if (!sourceItemId && !sourceKey) {
      return send(res, 400, { ok: false, error: "sourceItemId أو sourceKey مطلوب." }), true;
    }
    try {
      const files = sourceItemId
        ? await conversionSvc.listForItem(sourceItemId)
        : await conversionSvc.listForKey(sourceKey);
      return (
        send(res, 200, {
          ok: true,
          result: files.map((f) => ({
            id: f.id,
            sourceItemId: f.sourceItemId,
            sourceKey: f.sourceKey,
            conversionType: f.conversionType,
            label: f.label,
            status: f.status,
            outputKey: f.outputKey,
            mimeType: f.mimeType,
            fileSizeBytes: f.fileSizeBytes != null ? Number(f.fileSizeBytes) : null,
            errorMessage: f.errorMessage,
            jobId: f.jobId,
            createdBy: f.createdBy,
            createdAt: f.createdAt,
            completedAt: f.completedAt,
          })),
        }),
        true
      );
    } catch {
      return send(res, 500, { ok: false, error: "فشل جلب الملفات المشتقة." }), true;
    }
  }

  // POST /api/projects/export — MP4 export via ffmpeg
  if (req.method === "POST" && url.split("?")[0] === "/api/projects/export") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAuth(req, res)) return true;
    let outFile;
    try {
      const body = await readJsonBody(req);
      const timeline = body?.timeline;
      if (!timeline || !Array.isArray(timeline.clips) || !timeline.clips.length) {
        return send(res, 400, { ok: false, error: "حمولة timeline غير صالحة أو فارغة." }), true;
      }
      const result = await runExport(timeline, { rootDir: mediaRootDir, ffmpegPath });
      outFile = result.output;
      const { createReadStream, statSync } = await import("node:fs");
      const size = statSync(outFile).size;
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": size,
        "Content-Disposition": `attachment; filename="${(timeline.project?.name || "export").replace(/[^\w.-]/g, "_")}.mp4"`,
      });
      const stream = createReadStream(outFile);
      stream.pipe(res);
      await new Promise((resolve) => {
        stream.on("close", resolve);
        stream.on("error", resolve);
      });
      return true;
    } catch (error) {
      const statusCode = error?.statusCode || 500;
      return (
        send(res, statusCode, {
          ok: false,
          error: error?.message || "Export failed",
          code: error?.code || "EXPORT_FAILED",
        }),
        true
      );
    } finally {
      if (outFile) {
        try {
          (await import("node:fs")).unlinkSync(outFile);
        } catch { /* temp cleanup best-effort */ }
      }
    }
  }

  // ── File store routes (/api/files/...) ────────────────────────────────────

  if (url === "/api/files" && req.method === "GET") {
    if (!requireAuth(req, res)) return true;
    try {
      const result = await resolveFileStore().list(requestUrl.searchParams.get("prefix") || "");
      return send(res, 200, { ok: true, result }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File list failed" }), true;
    }
  }

  if (url === "/api/files/status" && req.method === "GET") {
    if (!requireAuth(req, res)) return true;
    try {
      const result = await buildFileStoreStatus(resolveFileStore());
      return send(res, 200, { ok: true, result }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File status failed" }), true;
    }
  }

  if (url === "/api/files/browser" && req.method === "GET") {
    if (!requireAuth(req, res)) return true;
    try {
      const result = await listEntries(resolveFileStore(), requestUrl.searchParams.get("path") || "", {
        query: requestUrl.searchParams.get("query") || "",
        limit: Math.min(200, Number(requestUrl.searchParams.get("limit")) || 200),
        cursor: requestUrl.searchParams.get("cursor") || "",
      });
      return send(res, 200, { ok: true, result }), true;
    } catch (error) {
      return (
        send(res, error?.statusCode || 500, {
          ok: false,
          error: error?.message || "File browse failed",
          details: {
            code: "FILE_BROWSE_FAILED",
            provider: resolveFileStore()?.describe?.().kind || "unknown",
            retryable: (error?.statusCode || 500) >= 500,
          },
        }),
        true
      );
    }
  }

  if (url === "/api/files/folders" && req.method === "POST") {
    if (!requireEditor(req, res)) return true;
    try {
      const body = await readJsonBody(req);
      const result = await createFolder(resolveFileStore(), body?.path);
      return send(res, 201, { ok: true, result }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Folder creation failed" }), true;
    }
  }

  if (url === "/api/files/actions" && req.method === "POST") {
    if (!requireEditor(req, res)) return true;
    try {
      const body = await readJsonBody(req);
      const action = String(body?.action || "").toLowerCase();
      const store = resolveFileStore();
      if (action === "delete") {
        return (
          send(res, 200, { ok: true, result: { action, results: await removeEntries(store, body?.keys || []) } }),
          true
        );
      }
      if (action === "rename") {
        const source = normalizeFileKey(body?.key);
        const name = normalizeFileKey(body?.name);
        if (name.includes("/")) {
          return send(res, 400, { ok: false, error: "اسم الملف الجديد يجب ألا يحتوي على مسار." }), true;
        }
        const parent = source.includes("/") ? source.slice(0, source.lastIndexOf("/")) : "";
        const destination = parent ? `${parent}/${name}` : name;
        const value = await moveEntry(store, source, destination);
        return (
          send(res, 200, {
            ok: true,
            result: { action, results: [{ key: source, destination, ok: true, value }] },
          }),
          true
        );
      }
      if (action === "copy" || action === "move") {
        const destinationFolder = normalizeFileKey(body?.destination, { allowEmpty: true });
        const results = [];
        for (const rawKey of body?.keys || []) {
          const key = normalizeFileKey(rawKey);
          const name = key.slice(key.lastIndexOf("/") + 1);
          const destination = destinationFolder ? `${destinationFolder}/${name}` : name;
          try {
            const value =
              action === "copy"
                ? await copyEntry(store, key, destination)
                : await moveEntry(store, key, destination);
            results.push({ key, destination, ok: true, value });
          } catch (error) {
            results.push({ key, destination, ok: false, error: error?.message || `${action} failed` });
          }
        }
        return send(res, 200, { ok: true, result: { action, results } }), true;
      }
      return send(res, 400, { ok: false, error: "عملية الملفات غير مدعومة." }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File action failed" }), true;
    }
  }

  if (url === "/api/files/url" && req.method === "GET") {
    if (!requireAuth(req, res)) return true;
    try {
      const key = requestUrl.searchParams.get("key") || "";
      if (!key) return send(res, 400, { ok: false, error: "File key is required." }), true;
      const files = resolveFileStore();
      if (typeof files?.getUrl !== "function") {
        return send(res, 501, { ok: false, error: "File URL lookup is not supported." }), true;
      }
      const result = await files.getUrl(key);
      if (!result) return send(res, 404, { ok: false, error: "File URL not found." }), true;
      return send(res, 200, { ok: true, result }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File URL lookup failed" }), true;
    }
  }

  // PUT/GET/DELETE /api/files/:key
  if (url.startsWith("/api/files/")) {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    const key = decodeURIComponent(url.slice("/api/files/".length));
    try {
      const files = resolveFileStore();
      if (req.method === "PUT") {
        const declaredMime = req.headers["content-type"] || "";
        let result;
        let imageMetadata = null;
        if (PROCESSABLE_IMAGE_TYPES.has(declaredMime)) {
          const bytes = await readRawBody(req);
          const detectedMime = detectImageMimeType(bytes) || declaredMime;
          if (PROCESSABLE_IMAGE_TYPES.has(detectedMime)) {
            const { variants, metadata } = await processImage(bytes, detectedMime);
            imageMetadata = metadata;
            for (const variant of variants) {
              const variantKey = `${key}@${variant.name}.webp`;
              try {
                await files.putBlob(variantKey, variant.buffer, { contentType: "image/webp" });
              } catch (variantErr) {
                reqLog.warn({ variantKey, err: variantErr?.message }, "Image variant storage failed");
              }
            }
          }
          result = await files.putBlob(key, bytes, { contentType: declaredMime });
        } else {
          if (typeof files.putStream === "function") {
            result = await files.putStream(key, req, { contentType: declaredMime });
          } else {
            result = await files.putBlob(key, req, { contentType: declaredMime });
          }
        }
        notifyUploadComplete({ prisma, sendMail: notificationSendMail, userId: claims.sub, recordTitle: key });
        sendPushToUser({ prisma, userId: claims.sub, type: "upload", title: `اكتملت معالجة الملف — ${key}`, url: "/" });
        return (
          send(res, 200, { ok: true, result, ...(imageMetadata ? { imageMetadata } : {}) }),
          true
        );
      }
      if (req.method === "GET") {
        const blob = await files.getBlob(key);
        if (!blob) return send(res, 404, { ok: false, error: "File not found." }), true;
        const bytes = Buffer.isBuffer(blob) ? blob : Buffer.from(await blob.arrayBuffer());
        res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": bytes.length });
        res.end(bytes);
        return true;
      }
      if (req.method === "DELETE") {
        let secureResult = null;
        const storeInfo = typeof files.describe === "function" ? files.describe() : {};
        if (storeInfo.kind === "disk" && storeInfo.rootDir) {
          const nodePath = await import("node:path");
          const localPath = nodePath.default.resolve(
            storeInfo.rootDir,
            key.replace(/\//g, nodePath.default.sep)
          );
          try {
            secureResult = await secureOverwrite(localPath);
            auditLog({
              method: "secure-delete",
              args: [key],
              claims: claims || {},
              ip: clientIp(req),
              result: { fileSizeBytes: secureResult.fileSizeBytes, passes: secureResult.passes, skipped: secureResult.skipped || false },
            });
          } catch (wipeErr) {
            reqLog.warn({ key, err: wipeErr?.message }, "secureOverwrite failed — falling back to standard remove");
            await files.remove(key);
          }
        } else {
          await files.remove(key);
        }
        return send(res, 200, { ok: true, result: true, secureDelete: secureResult !== null }), true;
      }
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File operation failed" }), true;
    }
  }

  // ── Chunked / resumable upload sessions ──────────────────────────────────

  if (url === "/api/upload-sessions" && req.method === "POST") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    try {
      const body = await readJsonBody(req);
      const { key, contentType, totalSize, totalChunks } = body || {};
      const result = await initUploadSession({
        key, contentType, totalSize: Number(totalSize), totalChunks: Number(totalChunks), userId: claims.sub,
      });
      return send(res, 201, { ok: true, ...result, chunkSize: UPLOAD_CHUNK_BYTES }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message }), true;
    }
  }

  if (url.startsWith("/api/upload-sessions/")) {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    const rest = url.slice("/api/upload-sessions/".length);
    const slashIdx = rest.indexOf("/");
    const uploadId = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
    const subPath = slashIdx === -1 ? "" : rest.slice(slashIdx + 1);
    try {
      if (req.method === "GET" && subPath === "status") {
        const result = uploadSessionStatus({ uploadId, userId: claims.sub });
        return send(res, 200, { ok: true, ...result }), true;
      }
      if (req.method === "PUT" && subPath.startsWith("chunks/")) {
        const chunkIndex = parseInt(subPath.slice("chunks/".length), 10);
        const result = await receiveChunk({ uploadId, chunkIndex, data: req, userId: claims.sub });
        return send(res, 200, { ok: true, ...result }), true;
      }
      if (req.method === "POST" && subPath === "complete") {
        const files = resolveFileStore();
        const result = await completeUploadSession({ uploadId, userId: claims.sub, files });
        notifyUploadComplete({ prisma, sendMail: notificationSendMail, userId: claims.sub, recordTitle: result?.key || uploadId });
        sendPushToUser({ prisma, userId: claims.sub, type: "upload", title: `اكتمل الرفع — ${result?.key || uploadId}`, url: "/" });
        return send(res, 200, { ok: true, result }), true;
      }
      if (req.method === "DELETE" && !subPath) {
        const result = await abortUploadSession({ uploadId, userId: claims.sub });
        return send(res, 200, { ok: true, ...result }), true;
      }
      return send(res, 404, { ok: false, error: "Not found" }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message }), true;
    }
  }

  return false; // not handled
}
