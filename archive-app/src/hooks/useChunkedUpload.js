import React from "react";

/**
 * Real file upload with progress, SHA-256 de-duplication, and resumable
 * server-side chunked upload.
 *
 * Strategy:
 * - Files > LARGE_FILE_THRESHOLD use the chunked session API:
 *     POST /api/upload-sessions
 *     PUT  /api/upload-sessions/:id/chunks/:index
 *     POST /api/upload-sessions/:id/complete
 *   This lets the client resume after a network drop without restarting.
 *
 * - Files ≤ LARGE_FILE_THRESHOLD use a single whole-blob PUT for simplicity.
 */

export const UPLOAD_CHUNK_BYTES = 5 * 1024 * 1024; // 5 MB
const LARGE_FILE_THRESHOLD = UPLOAD_CHUNK_BYTES;    // use chunked API above this size

/**
 * Compute a SHA-256 hex digest of a File/Blob.
 * Reads in UPLOAD_CHUNK_BYTES slices to yield to the event loop between slices.
 * Falls back to a size+name pseudo-key when Web Crypto is unavailable.
 * @param {Blob} blob
 * @param {(ratio: number) => void} [onProgress] 0..1
 * @returns {Promise<string>} hex digest
 */
export async function hashBlob(blob, onProgress) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.digest) {
    return `nohash-${blob.size}-${(blob.name || "blob").replace(/[^\w.-]/g, "_")}`;
  }
  const total = blob.size || 1;
  const parts = [];
  for (let offset = 0; offset < blob.size; offset += UPLOAD_CHUNK_BYTES) {
    const slice = blob.slice(offset, Math.min(offset + UPLOAD_CHUNK_BYTES, blob.size));
    parts.push(new Uint8Array(await slice.arrayBuffer()));
    onProgress?.(Math.min(offset + UPLOAD_CHUNK_BYTES, blob.size) / total);
  }
  const merged = new Uint8Array(blob.size);
  let pos = 0;
  for (const part of parts) { merged.set(part, pos); pos += part.length; }
  const digest = await subtle.digest("SHA-256", merged);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Whole-blob upload (small files / fallback) ────────────────────────────────

/**
 * PUT a whole blob to `{baseUrl}/api/files/{key}` with progress + cancellation.
 * Uses XHR because fetch() cannot report request-body upload progress.
 * @returns {Promise<{ key: string, url?: string }>}
 */
export function putBlobWithProgress({ baseUrl = "", key, blob, getToken, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const base = String(baseUrl || "").replace(/\/+$/, "");
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${base}/api/files/${encodeURIComponent(key)}`);
    const token = typeof getToken === "function" ? getToken() : "";
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (blob?.type) xhr.setRequestHeader("Content-Type", blob.type);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress?.(ev.loaded / ev.total);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`فشل الرفع (HTTP ${xhr.status})`));
        return;
      }
      let payload;
      try { payload = JSON.parse(xhr.responseText); } catch { payload = null; }
      if (payload?.ok === false) { reject(new Error(payload.error || "فشل الرفع")); return; }
      resolve(payload?.result || { key });
    };
    xhr.onerror = () => reject(new Error("انقطع الاتصال أثناء الرفع"));
    xhr.onabort = () => reject(new DOMException("ألغي الرفع", "AbortError"));
    if (signal) {
      if (signal.aborted) { xhr.abort(); return; }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(blob);
  });
}

// ── Chunked session upload (large files) ──────────────────────────────────────

/**
 * Upload a blob using the server-side chunked session API.
 * Pass `existingUploadId` + `existingReceivedIndices` to resume a broken upload.
 * @returns {Promise<{ key: string, url?: string }>}
 */
export async function putBlobChunked({
  baseUrl = "",
  key,
  blob,
  getToken,
  onProgress,
  signal,
  existingUploadId = null,
  existingReceivedIndices = null,
}) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const token = typeof getToken === "function" ? getToken() : "";
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const jsonHeaders = { "Content-Type": "application/json", ...authHeaders };

  const totalChunks = Math.ceil(blob.size / UPLOAD_CHUNK_BYTES);
  let uploadId = existingUploadId;
  const alreadyReceived = new Set(existingReceivedIndices || []);

  // 1. Init session (skip if resuming)
  if (!uploadId) {
    const initRes = await fetch(`${base}/api/upload-sessions`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        key,
        contentType: blob.type || "application/octet-stream",
        totalSize: blob.size,
        totalChunks,
      }),
      signal,
    });
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new Error(err.error || `Init failed (HTTP ${initRes.status})`);
    }
    const initData = await initRes.json();
    uploadId = initData.uploadId;
  }

  // 2. Upload chunks sequentially, skipping already-received ones
  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) throw new DOMException("ألغي الرفع", "AbortError");

    if (alreadyReceived.has(i)) {
      onProgress?.((i + 1) / totalChunks);
      continue;
    }

    const start = i * UPLOAD_CHUNK_BYTES;
    const chunk = blob.slice(start, Math.min(start + UPLOAD_CHUNK_BYTES, blob.size));

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `${base}/api/upload-sessions/${uploadId}/chunks/${i}`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          onProgress?.((i + ev.loaded / ev.total) / totalChunks);
        }
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`فشل رفع الجزء ${i} (HTTP ${xhr.status})`));
          return;
        }
        onProgress?.((i + 1) / totalChunks);
        resolve();
      };
      xhr.onerror = () => reject(new Error(`انقطع الاتصال أثناء رفع الجزء ${i}`));
      xhr.onabort = () => reject(new DOMException("ألغي الرفع", "AbortError"));
      if (signal) {
        if (signal.aborted) { xhr.abort(); return; }
        signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }
      xhr.send(chunk);
    });
  }

  // 3. Complete — assemble on server
  const completeRes = await fetch(`${base}/api/upload-sessions/${uploadId}/complete`, {
    method: "POST",
    headers: jsonHeaders,
    signal,
  });
  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({}));
    throw new Error(err.error || `Complete failed (HTTP ${completeRes.status})`);
  }
  const completeData = await completeRes.json();
  return completeData.result || { key };
}

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * Drives a single upload through hash → upload, reporting status to the store.
 * Automatically picks chunked (large files) vs whole-blob (small files).
 *
 * @param {object} deps
 * @param {string} [deps.baseUrl]
 * @param {() => string} [deps.getToken]
 * @param {(id: string, patch: object) => void} deps.onUpdate
 * @param {(key: string) => boolean} [deps.isDuplicate]
 */
export function useChunkedUpload({ baseUrl = "", getToken, onUpdate, isDuplicate } = {}) {
  const controllers = React.useRef(new Map());

  const cancel = React.useCallback((id) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
  }, []);

  const start = React.useCallback(
    async (item) => {
      const { id, file } = item;
      const controller = new AbortController();
      controllers.current.set(id, controller);
      try {
        onUpdate(id, { status: "hashing", progress: 0 });
        const key = await hashBlob(file, (ratio) =>
          onUpdate(id, { progress: Math.round(ratio * 100) })
        );

        if (isDuplicate?.(key)) {
          onUpdate(id, { status: "duplicate", progress: 100, key });
          controllers.current.delete(id);
          return { id, key, duplicate: true };
        }

        onUpdate(id, { status: "uploading", progress: 0, key });

        const uploadFn = file.size > LARGE_FILE_THRESHOLD ? putBlobChunked : putBlobWithProgress;
        const result = await uploadFn({
          baseUrl,
          key,
          blob: file,
          getToken,
          signal: controller.signal,
          onProgress: (ratio) => onUpdate(id, { progress: Math.round(ratio * 100) }),
        });

        onUpdate(id, { status: "done", progress: 100, key, url: result?.url });
        controllers.current.delete(id);
        return { id, key, url: result?.url };
      } catch (error) {
        controllers.current.delete(id);
        const aborted = error?.name === "AbortError";
        onUpdate(id, {
          status: aborted ? "paused" : "error",
          error: aborted ? null : (error?.message || "فشل الرفع"),
        });
        return { id, error: error?.message, aborted };
      }
    },
    [baseUrl, getToken, onUpdate, isDuplicate]
  );

  React.useEffect(() => {
    const map = controllers.current;
    return () => {
      for (const controller of map.values()) controller.abort();
      map.clear();
    };
  }, []);

  return { start, cancel };
}
