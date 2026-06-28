// @ts-nocheck
// G5 — project export client (browser side).
//
// Three export paths for a montage project, all driven by the pure timeline
// built in viewModel.js (buildProjectTimeline / buildEdl):
//   • JSON  — the NLE-interchange timeline, downloaded client-side.
//   • EDL   — a CMX3600 edit list, downloaded client-side (DaVinci/Premiere).
//   • MP4   — rendered on archive-server (POST /api/projects/export) where
//             ffmpeg lives in the same Docker image; the SPA streams the file
//             back and downloads it. Needs a cloud backend + a JWT.
//
// All side-effecting bits (fetch, DOM download) are injectable so the logic is
// unit-testable without a browser or a server.

export class CloudExportError extends Error {
  constructor(message, { status, code, cause } = {}) {
    super(message);
    this.name = "CloudExportError";
    this.status = status;
    this.code = code;
    this.cause = cause;
  }
}

/** Safe filename fragment from a project name (mirrors the server's sanitizer). */
export function safeFileName(name, fallback = "export") {
  const clean = String(name || "").trim().replace(/[^\w؀-ۿ.-]+/g, "_").replace(/^_+|_+$/g, "");
  return clean || fallback;
}

/**
 * Trigger a browser download for a Blob. Injectable doc/URL for tests.
 * Returns false (no-op) when there's no DOM (SSR / node tests without injection).
 */
export function triggerDownload(blob, filename, { doc = safeDocument(), urlApi = safeUrl() } = {}) {
  if (!doc || !urlApi?.createObjectURL) return false;
  const href = urlApi.createObjectURL(blob);
  const link = doc.createElement("a");
  link.href = href;
  link.download = filename;
  doc.body.appendChild(link);
  link.click();
  doc.body.removeChild(link);
  // Revoke on the next tick so the click has time to start the download.
  if (typeof setTimeout === "function") setTimeout(() => urlApi.revokeObjectURL?.(href), 0);
  else urlApi.revokeObjectURL?.(href);
  return true;
}

/** Download the timeline JSON. `timeline` is the object from buildProjectTimeline. */
export function downloadTimelineJson(timeline, name, deps = {}) {
  const filename = `${safeFileName(name)}.timeline.json`;
  const blob = makeBlob(JSON.stringify(timeline, null, 2), "application/json", deps);
  return triggerDownload(blob, filename, deps);
}

/** Download a CMX3600 EDL string. */
export function downloadEdl(edlString, name, deps = {}) {
  const filename = `${safeFileName(name)}.edl`;
  const blob = makeBlob(String(edlString || ""), "text/plain", deps);
  return triggerDownload(blob, filename, deps);
}

/** Whether MP4 export is possible: needs a cloud backend and a token. */
export function canExportMp4({ backend, token, wasmAvailable = hasFfmpegWasmSupport() } = {}) {
  return (backend !== "local" && Boolean(token)) || Boolean(wasmAvailable);
}

export function hasFfmpegWasmSupport({ globalScope = safeGlobalThis() } = {}) {
  return typeof globalScope?.__archiveFfmpegWasmExport === "function";
}

/**
 * Render the timeline to MP4 on the server and return the resulting Blob.
 * @param {object} args
 * @param {object} args.timeline - from buildProjectTimeline (must have clips)
 * @param {string} [args.baseUrl=""] - server origin ("" = same-origin)
 * @param {() => string} [args.getToken] - returns the JWT
 * @param {typeof fetch} [args.fetchImpl] - injectable for tests
 * @returns {Promise<Blob>}
 */
export async function requestMp4Export({
  timeline,
  baseUrl = "",
  getToken,
  fetchImpl,
  allowWasmFallback = false,
  wasmRenderer,
  sourceResolver,
  BlobImpl
} = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!timeline || !Array.isArray(timeline.clips) || timeline.clips.length === 0) {
    throw new CloudExportError("لا توجد قصاصات قابلة للتصدير في المشروع.");
  }
  const token = typeof getToken === "function" ? getToken() : "";
  const useWasm = () => requestMp4ExportWasm({ timeline, wasmRenderer, sourceResolver, BlobImpl });
  if (!doFetch || !token) {
    if (allowWasmFallback) return useWasm();
    if (!doFetch) throw new CloudExportError("لا يوجد منفّذ fetch.", { code: "NO_FETCH" });
    throw new CloudExportError("تصدير MP4 يتطلّب تسجيل الدخول إلى خادم سحابي.", { code: "NO_TOKEN" });
  }

  const base = String(baseUrl || "").replace(/\/+$/, "");
  let response;
  try {
    response = await doFetch(`${base}/api/projects/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ timeline })
    });
  } catch (networkError) {
    if (allowWasmFallback) return useWasm();
    throw new CloudExportError(`تعذّر الاتصال بخادم التصدير: ${networkError?.message || "خطأ شبكة"}`, { code: "NETWORK", cause: networkError });
  }

  if (!response.ok) {
    let message = "فشل تصدير MP4.";
    let code = "SERVER";
    try {
      const payload = await response.json();
      message = payload?.error || message;
      code = payload?.code || code;
    } catch { /* non-JSON error body */ }
    if (allowWasmFallback && (response.status === 0 || response.status >= 500 || response.status === 503)) return useWasm();
    throw new CloudExportError(message, { status: response.status, code });
  }
  return response.blob();
}

export async function requestMp4ExportWasm({ timeline, wasmRenderer, sourceResolver, BlobImpl } = {}) {
  if (!timeline || !Array.isArray(timeline.clips) || timeline.clips.length === 0) {
    throw new CloudExportError("لا توجد قصاصات قابلة للتصدير في المشروع.", { code: "EMPTY" });
  }
  const renderer = wasmRenderer || safeGlobalThis()?.__archiveFfmpegWasmExport;
  if (typeof renderer !== "function") {
    throw new CloudExportError("ffmpeg.wasm غير متاح في هذه البيئة. ثبّت مكوّن wasm أو استخدم خادمًا يحتوي ffmpeg.", { code: "WASM_UNAVAILABLE" });
  }
  try {
    const output = await renderer({ timeline, sourceResolver });
    return normalizeMp4Blob(output, { BlobImpl });
  } catch (error) {
    if (error instanceof CloudExportError) throw error;
    throw new CloudExportError(`فشل ffmpeg.wasm: ${error?.message || "خطأ غير معروف"}`, { code: "WASM_FAILED", cause: error });
  }
}

/** Render to MP4 and immediately download it. Convenience wrapper. */
export async function exportProjectMp4(args = {}) {
  const blob = await requestMp4Export(args);
  triggerDownload(blob, `${safeFileName(args?.name || args?.timeline?.project?.name)}.mp4`, args);
  return blob;
}

// ── internals ──────────────────────────────────────────────────────────────

function makeBlob(content, type, { BlobImpl } = {}) {
  const Ctor = BlobImpl || (typeof Blob !== "undefined" ? Blob : null);
  if (!Ctor) throw new CloudExportError("بيئة بلا دعم Blob.");
  return new Ctor([content], { type });
}

function normalizeMp4Blob(output, deps = {}) {
  const Ctor = deps.BlobImpl || (typeof Blob !== "undefined" ? Blob : null);
  if (!Ctor) throw new CloudExportError("بيئة بلا دعم Blob.", { code: "NO_BLOB" });
  if (output instanceof Ctor) return output;
  if (output?.blob) return normalizeMp4Blob(output.blob, deps);
  if (output instanceof ArrayBuffer || ArrayBuffer.isView(output) || typeof output === "string") {
    return new Ctor([output], { type: "video/mp4" });
  }
  throw new CloudExportError("ffmpeg.wasm لم يُرجع ملف MP4 صالحًا.", { code: "WASM_BAD_OUTPUT" });
}

function safeDocument() {
  try {
    if (typeof document !== "undefined") return document;
  } catch { /* no DOM */ }
  return null;
}

function safeUrl() {
  try {
    if (typeof URL !== "undefined") return URL;
  } catch { /* no URL */ }
  return null;
}

function safeGlobalThis() {
  try {
    return typeof globalThis !== "undefined" ? globalThis : null;
  } catch { /* no global */ }
  return null;
}

