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
  constructor(message, { status } = {}) {
    super(message);
    this.name = "CloudExportError";
    this.status = status;
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
export function canExportMp4({ backend, token } = {}) {
  return backend !== "local" && Boolean(token);
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
export async function requestMp4Export({ timeline, baseUrl = "", getToken, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new CloudExportError("لا يوجد منفّذ fetch.");
  if (!timeline || !Array.isArray(timeline.clips) || timeline.clips.length === 0) {
    throw new CloudExportError("لا توجد قصاصات قابلة للتصدير في المشروع.");
  }
  const token = typeof getToken === "function" ? getToken() : "";
  if (!token) throw new CloudExportError("تصدير MP4 يتطلّب تسجيل الدخول إلى خادم سحابي.");

  const base = String(baseUrl || "").replace(/\/+$/, "");
  let response;
  try {
    response = await doFetch(`${base}/api/projects/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ timeline })
    });
  } catch (networkError) {
    throw new CloudExportError(`تعذّر الاتصال بخادم التصدير: ${networkError?.message || "خطأ شبكة"}`);
  }

  if (!response.ok) {
    let message = "فشل تصدير MP4.";
    try {
      const payload = await response.json();
      message = payload?.error || message;
    } catch { /* non-JSON error body */ }
    throw new CloudExportError(message, { status: response.status });
  }
  return response.blob();
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
