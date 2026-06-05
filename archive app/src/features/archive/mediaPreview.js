const HTML5_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".ogg",
  ".ogv",
  ".mov",
  ".m4v"
]);

export const MEDIA_PREVIEW_STATUS = {
  PLAYABLE: "playable",
  LOADING: "loading",
  MISSING_PATH: "missing-path",
  UNSUPPORTED_FORMAT: "unsupported-format",
  BLOCKED_LOCAL_PATH: "blocked-local-path",
  TIMED_OUT: "timed-out"
};

function getExtension(value = "") {
  const clean = String(value).split("?")[0].split("#")[0].trim().toLowerCase();
  const dotIndex = clean.lastIndexOf(".");
  return dotIndex >= 0 ? clean.slice(dotIndex) : "";
}

function isHttpRuntime(protocol = "") {
  return /^https?:$/i.test(String(protocol || ""));
}

export function isLocalFilePath(path = "") {
  const value = String(path || "").trim();
  if (!value) return false;
  return /^(file:|[a-z]:[\\/]|\\\\|\/)/i.test(value);
}

function encodeFilePathSegments(path) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function encodeWindowsFilePath(path) {
  const drive = path.slice(0, 2);
  const rest = path.slice(3);
  return rest ? `${drive}/${encodeFilePathSegments(rest)}` : `${drive}/`;
}

export function isHtml5PreviewableVideo(path = "") {
  return HTML5_VIDEO_EXTENSIONS.has(getExtension(path));
}

export function getHtml5VideoPreviewSource(path = "") {
  const value = String(path || "").trim();
  if (!value || !isHtml5PreviewableVideo(value)) return null;
  if (/^(https?:|blob:|data:|file:)/i.test(value)) return value;
  const normalized = value.replace(/\\/g, "/");
  if (/^[a-z]:\//i.test(normalized)) {
    return `file:///${encodeWindowsFilePath(normalized)}`;
  }
  if (normalized.startsWith("/")) {
    return `file://${encodeFilePathSegments(normalized)}`;
  }
  return null;
}

export function getMediaPreviewDescriptor(path = "", options = {}) {
  const value = String(path || "").trim();
  const extension = getExtension(value);
  const runtimeProtocol = options.runtimeProtocol || "";
  const localPath = isLocalFilePath(value);

  if (!value) {
    return {
      status: MEDIA_PREVIEW_STATUS.MISSING_PATH,
      source: null,
      path: value,
      extension,
      localPath
    };
  }

  if (!HTML5_VIDEO_EXTENSIONS.has(extension)) {
    return {
      status: MEDIA_PREVIEW_STATUS.UNSUPPORTED_FORMAT,
      source: null,
      path: value,
      extension,
      localPath
    };
  }

  if (localPath && isHttpRuntime(runtimeProtocol)) {
    return {
      status: MEDIA_PREVIEW_STATUS.BLOCKED_LOCAL_PATH,
      source: null,
      path: value,
      extension,
      localPath
    };
  }

  const source = getHtml5VideoPreviewSource(value);
  return {
    status: source ? MEDIA_PREVIEW_STATUS.PLAYABLE : MEDIA_PREVIEW_STATUS.BLOCKED_LOCAL_PATH,
    source,
    path: value,
    extension,
    localPath
  };
}
