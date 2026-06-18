import dns from "node:dns/promises";
import net from "node:net";

export const IMPORT_KINDS = Object.freeze({
  YOUTUBE: "youtube",
  GOOGLE_DRIVE: "googledrive",
  WEB: "web",
  UNKNOWN: "unknown"
});

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;
const MAX_URLS = 25;
const MAX_HTML_CHARS = 256 * 1024;

function safeParseUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

function extractYoutubeId(url) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return YOUTUBE_ID_PATTERN.test(id) ? id : "";
  }
  if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
    const watchId = url.searchParams.get("v");
    if (watchId && YOUTUBE_ID_PATTERN.test(watchId)) return watchId;
    const segments = url.pathname.split("/").filter(Boolean);
    if (["shorts", "embed", "v"].includes(segments[0]) && YOUTUBE_ID_PATTERN.test(segments[1] || "")) {
      return segments[1];
    }
  }
  return "";
}

function extractDriveId(url) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") return "";
  const segments = url.pathname.split("/").filter(Boolean);
  const fileIndex = segments.findIndex((segment) => segment === "d");
  if (fileIndex >= 0 && DRIVE_ID_PATTERN.test(segments[fileIndex + 1] || "")) {
    return segments[fileIndex + 1];
  }
  const openId = url.searchParams.get("id");
  return openId && DRIVE_ID_PATTERN.test(openId) ? openId : "";
}

function detectSource(input) {
  const url = safeParseUrl(input);
  if (!url) return { kind: IMPORT_KINDS.UNKNOWN, url: String(input || "").trim(), normalizedUrl: "" };
  const normalizedUrl = url.toString();
  const youtubeId = extractYoutubeId(url);
  if (youtubeId) return { kind: IMPORT_KINDS.YOUTUBE, url, normalizedUrl, sourceId: youtubeId };
  const driveId = extractDriveId(url);
  if (driveId) return { kind: IMPORT_KINDS.GOOGLE_DRIVE, url, normalizedUrl, sourceId: driveId };
  return { kind: IMPORT_KINDS.WEB, url, normalizedUrl };
}

function isPrivateIPv4(address) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateAddress(address) {
  const value = String(address || "").toLowerCase();
  const family = net.isIP(value);
  if (family === 4) return isPrivateIPv4(value);
  if (family === 6) {
    return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
  }
  return true;
}

async function assertPublicHost(url, lookupHost) {
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    const error = new Error("Private hosts are not allowed.");
    error.code = "private_host";
    throw error;
  }
  if (net.isIP(host) && isPrivateAddress(host)) {
    const error = new Error("Private hosts are not allowed.");
    error.code = "private_host";
    throw error;
  }
  const addresses = await lookupHost(host);
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address || entry))) {
    const error = new Error("Private hosts are not allowed.");
    error.code = "private_host";
    throw error;
  }
}

function headerValue(headers, name) {
  if (typeof headers?.get === "function") return headers.get(name);
  return headers?.[name] || headers?.[name.toLowerCase()] || "";
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html, pattern) {
  const match = pattern.exec(html);
  return match ? decodeHtml(match[1]) : "";
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return firstMatch(
    html,
    new RegExp(`<meta\\s+(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i")
  ) || firstMatch(
    html,
    new RegExp(`<meta\\s+content=["']([^"']+)["'][^>]*(?:name|property)=["']${escaped}["'][^>]*>`, "i")
  );
}

function parseHtmlMetadata(html, url) {
  const text = String(html || "").slice(0, MAX_HTML_CHARS);
  const title = metaContent(text, "og:title") || firstMatch(text, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = metaContent(text, "description") || metaContent(text, "og:description");
  const thumbnailUrl = metaContent(text, "og:image");
  return {
    title: title || url.hostname.replace(/^www\./, ""),
    description: description.slice(0, 500),
    thumbnailUrl
  };
}

function okItem(source, extra = {}) {
  return {
    ok: true,
    kind: source.kind,
    url: source.normalizedUrl,
    ...(source.sourceId ? { sourceId: source.sourceId } : {}),
    ...extra
  };
}

function errorItem(input, errorCode, error) {
  return {
    ok: false,
    url: String(input || "").trim(),
    kind: IMPORT_KINDS.UNKNOWN,
    errorCode,
    error: error || "Import preview failed."
  };
}

export function createImportPreviewService({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  lookupHost = (host) => dns.lookup(host, { all: true, verbatim: true }),
  timeoutMs = 5000
} = {}) {
  async function previewOne(input) {
    const source = detectSource(input);
    if (source.kind === IMPORT_KINDS.UNKNOWN) {
      return errorItem(input, "invalid_url", "Only http(s) URLs are supported.");
    }
    if (source.kind === IMPORT_KINDS.YOUTUBE) {
      return okItem(source, {
        title: `YouTube: ${source.sourceId}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${source.sourceId}/hqdefault.jpg`
      });
    }
    if (source.kind === IMPORT_KINDS.GOOGLE_DRIVE) {
      return okItem(source, { title: `Google Drive: ${source.sourceId}` });
    }
    try {
      await assertPublicHost(source.url, lookupHost);
      if (!fetchImpl) throw new Error("fetch unavailable");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetchImpl(source.normalizedUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "Accept": "text/html,application/xhtml+xml" }
      });
      clearTimeout(timer);
      if (!response?.ok) return errorItem(source.normalizedUrl, "fetch_failed", `HTTP ${response?.status || 0}`);
      const type = String(headerValue(response.headers, "content-type") || "");
      if (type && !type.toLowerCase().includes("html")) {
        return okItem(source, { title: source.url.pathname.split("/").filter(Boolean).pop() || source.url.hostname });
      }
      return okItem(source, parseHtmlMetadata(await response.text(), source.url));
    } catch (error) {
      return errorItem(source.normalizedUrl, error?.code || "fetch_failed", error?.message || "Preview failed.");
    }
  }

  return async function preview({ urls = [], requestedBy = null } = {}) {
    const unique = [];
    const seen = new Set();
    for (const value of Array.isArray(urls) ? urls : []) {
      const key = String(value || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(key);
      if (unique.length >= MAX_URLS) break;
    }
    const items = [];
    for (const url of unique) items.push(await previewOne(url));
    return { ok: true, requestedBy, items };
  };
}

export const importPreviewService = createImportPreviewService();
