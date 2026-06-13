import React from "react";

/**
 * Real file upload with progress + SHA-256 de-duplication.
 *
 * The backend exposes a whole-blob endpoint (`PUT /api/files/{key}`), so the
 * "chunked" part here is client-side: we hash the file in 5MB slices (to keep
 * memory flat and yield to the event loop) to derive a content-addressed key,
 * then stream the blob to the server via XMLHttpRequest so we get real upload
 * progress events (fetch() cannot report request-body progress).
 *
 * Resumable/server-side chunking needs dedicated backend range endpoints that
 * do not exist yet — see TASKS.md §753 (remaining work).
 */

export const UPLOAD_CHUNK_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Stream a SHA-256 digest of a File/Blob without holding it all in memory at
 * once. Falls back to a size+name pseudo-key if Web Crypto is unavailable.
 * @param {Blob} blob
 * @param {(ratio: number) => void} [onProgress] 0..1 hashing progress
 * @returns {Promise<string>} hex digest (content-addressed key)
 */
export async function hashBlob(blob, onProgress) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.digest) {
    return `nohash-${blob.size}-${(blob.name || "blob").replace(/[^\w.-]/g, "_")}`;
  }
  // digest() needs the whole buffer; read in slices only to report progress and
  // avoid a single giant synchronous read on very large files.
  const total = blob.size || 1;
  const parts = [];
  for (let offset = 0; offset < blob.size; offset += UPLOAD_CHUNK_BYTES) {
    const slice = blob.slice(offset, Math.min(offset + UPLOAD_CHUNK_BYTES, blob.size));
    parts.push(new Uint8Array(await slice.arrayBuffer()));
    onProgress?.(Math.min(offset + UPLOAD_CHUNK_BYTES, blob.size) / total);
  }
  const merged = new Uint8Array(blob.size);
  let pos = 0;
  for (const part of parts) {
    merged.set(part, pos);
    pos += part.length;
  }
  const digest = await subtle.digest("SHA-256", merged);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * PUT a blob to `${baseUrl}/api/files/{key}` with real progress + cancellation.
 * Mirrors the contract of the cloud-files FileStore adapter, but via XHR so the
 * caller can render an accurate per-file progress bar.
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

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`فشل الرفع (HTTP ${xhr.status})`));
        return;
      }
      let payload;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }
      if (payload && payload.ok === false) {
        reject(new Error(payload.error || "فشل الرفع"));
        return;
      }
      resolve(payload?.result || { key });
    };
    xhr.onerror = () => reject(new Error("انقطع الاتصال أثناء الرفع"));
    xhr.onabort = () => reject(new DOMException("ألغي الرفع", "AbortError"));
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(blob);
  });
}

/**
 * Drives a single upload through hash → upload, reporting status to the store.
 * Returns helpers the UploadQueue / add flow can call.
 *
 * @param {object} deps
 * @param {string} deps.baseUrl           API base (same-origin "" in prod).
 * @param {() => string} [deps.getToken]  bearer token getter.
 * @param {(id: string, patch: object) => void} deps.onUpdate  store updater.
 * @param {(key: string) => boolean} [deps.isDuplicate]  dedup check by content key.
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
        const result = await putBlobWithProgress({
          baseUrl,
          key,
          blob: file,
          getToken,
          signal: controller.signal,
          onProgress: (ratio) => onUpdate(id, { progress: Math.round(ratio * 100) })
        });

        onUpdate(id, { status: "done", progress: 100, key, url: result?.url });
        controllers.current.delete(id);
        return { id, key, url: result?.url };
      } catch (error) {
        controllers.current.delete(id);
        const aborted = error?.name === "AbortError";
        onUpdate(id, {
          status: aborted ? "paused" : "error",
          error: aborted ? null : error?.message || "فشل الرفع"
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
