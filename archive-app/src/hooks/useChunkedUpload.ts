import React from "react";

type NamedBlob = Blob & { name?: string };

interface UploadResult {
  key: string;
  url?: string;
}

interface ChunkedUploadInput {
  baseUrl?: string;
  key: string;
  blob: Blob;
  getToken?: () => string;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

interface ChunkedUploadResumeInput extends ChunkedUploadInput {
  existingUploadId?: string | null;
  existingReceivedIndices?: number[] | null;
}

interface UploadUpdate {
  status?: string;
  progress?: number;
  key?: string;
  url?: string;
  error?: string | null;
}

interface ChunkedUploadItem {
  id: string;
  file: NamedBlob;
}

interface UseChunkedUploadOptions {
  baseUrl?: string;
  getToken?: () => string;
  onUpdate: (id: string, patch: UploadUpdate) => void;
  isDuplicate?: (key: string) => boolean;
}

interface ChunkedUploadOutcome {
  id: string;
  key?: string;
  url?: string;
  duplicate?: boolean;
  error?: string;
  aborted?: boolean;
}

export const UPLOAD_CHUNK_BYTES = 5 * 1024 * 1024;
const LARGE_FILE_THRESHOLD = UPLOAD_CHUNK_BYTES;

export async function hashBlob(blob: NamedBlob, onProgress?: (ratio: number) => void) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.digest) {
    return `nohash-${blob.size}-${(blob.name || "blob").replace(/[^\w.-]/g, "_")}`;
  }

  const total = blob.size || 1;
  const parts: Uint8Array[] = [];
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
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function putBlobWithProgress({
  baseUrl = "",
  key,
  blob,
  getToken,
  onProgress,
  signal,
}: ChunkedUploadInput): Promise<UploadResult> {
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
      let payload: { ok?: boolean; error?: string; result?: UploadResult } | null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }
      if (payload?.ok === false) {
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

export async function putBlobChunked({
  baseUrl = "",
  key,
  blob,
  getToken,
  onProgress,
  signal,
  existingUploadId = null,
  existingReceivedIndices = null,
}: ChunkedUploadResumeInput): Promise<UploadResult> {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const token = typeof getToken === "function" ? getToken() : "";
  const jsonHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (token) jsonHeaders.Authorization = `Bearer ${token}`;

  const totalChunks = Math.ceil(blob.size / UPLOAD_CHUNK_BYTES);
  let uploadId = existingUploadId;
  const alreadyReceived = new Set(existingReceivedIndices || []);

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
      const err = await initRes.json().catch(() => ({} as { error?: string }));
      throw new Error(err.error || `Init failed (HTTP ${initRes.status})`);
    }
    const initData = (await initRes.json()) as { uploadId: string };
    uploadId = initData.uploadId;
  }

  for (let index = 0; index < totalChunks; index++) {
    if (signal?.aborted) throw new DOMException("ألغي الرفع", "AbortError");

    if (alreadyReceived.has(index)) {
      onProgress?.((index + 1) / totalChunks);
      continue;
    }

    const start = index * UPLOAD_CHUNK_BYTES;
    const chunk = blob.slice(start, Math.min(start + UPLOAD_CHUNK_BYTES, blob.size));

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `${base}/api/upload-sessions/${uploadId}/chunks/${index}`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          onProgress?.((index + ev.loaded / ev.total) / totalChunks);
        }
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`فشل رفع الجزء ${index} (HTTP ${xhr.status})`));
          return;
        }
        onProgress?.((index + 1) / totalChunks);
        resolve();
      };
      xhr.onerror = () => reject(new Error(`انقطع الاتصال أثناء رفع الجزء ${index}`));
      xhr.onabort = () => reject(new DOMException("ألغي الرفع", "AbortError"));
      if (signal) {
        if (signal.aborted) {
          xhr.abort();
          return;
        }
        signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }
      xhr.send(chunk);
    });
  }

  const completeRes = await fetch(`${base}/api/upload-sessions/${uploadId}/complete`, {
    method: "POST",
    headers: jsonHeaders,
    signal,
  });
  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({} as { error?: string }));
    throw new Error(err.error || `Complete failed (HTTP ${completeRes.status})`);
  }
  const completeData = (await completeRes.json()) as { result?: UploadResult };
  return completeData.result || { key };
}

export function useChunkedUpload({
  baseUrl = "",
  getToken,
  onUpdate,
  isDuplicate,
}: UseChunkedUploadOptions) {
  const controllers = React.useRef<Map<string, AbortController>>(new Map());

  const cancel = React.useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
  }, []);

  const start = React.useCallback(
    async (item: ChunkedUploadItem): Promise<ChunkedUploadOutcome> => {
      const { id, file } = item;
      const controller = new AbortController();
      controllers.current.set(id, controller);
      try {
        onUpdate(id, { status: "hashing", progress: 0 });
        const key = await hashBlob(file, (ratio) => onUpdate(id, { progress: Math.round(ratio * 100) }));

        if (isDuplicate?.(key)) {
          onUpdate(id, { status: "duplicate", progress: 100, key });
          controllers.current.delete(id);
          return { id, key, duplicate: true };
        }

        onUpdate(id, { status: "uploading", progress: 0, key });

        const uploadArgs = {
          baseUrl,
          key,
          blob: file,
          getToken,
          signal: controller.signal,
          onProgress: (ratio: number) => onUpdate(id, { progress: Math.round(ratio * 100) }),
        };
        const result =
          file.size > LARGE_FILE_THRESHOLD
            ? await putBlobChunked(uploadArgs)
            : await putBlobWithProgress(uploadArgs);

        onUpdate(id, { status: "done", progress: 100, key, url: result?.url });
        controllers.current.delete(id);
        return { id, key, url: result?.url };
      } catch (error) {
        controllers.current.delete(id);
        const err = error as { name?: string; message?: string };
        const aborted = err?.name === "AbortError";
        onUpdate(id, {
          status: aborted ? "paused" : "error",
          error: aborted ? null : (err?.message || "فشل الرفع"),
        });
        return { id, error: err?.message, aborted };
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
