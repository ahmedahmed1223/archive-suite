import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import { getFileStore, getSyncProvider, getAiProvider, getStorageProvider } from "@archive/core";

import { logger, createLogger } from "../logger.js";
import { auditLog } from "./auditLogger.js";
import { dispatchRpc } from "./rpcHandler.js";
import { dispatchAi } from "./aiHandler.js";
import { handleSearch } from "./searchHandler.js";
import { checkFfmpegAvailability, exportTimelineToMp4 } from "../export/mp4.js";
import { createInMemoryMediaJobStore } from "../media/mediaJobs.js";
import { createConversionService } from "../conversion/conversionService.js";
import { createConversionJobRunner } from "../conversion/conversionJobRunner.js";
import { createSharePermissionService } from "../share/sharePermissionService.js";
import { createShareInvitationService } from "../share/invitationService.js";
import { runMediaDerivative, runMediaProbe } from "../media/runMedia.js";
import { verifyJwt, signJwt } from "../auth/jwt.js";
import { revokeToken } from "../auth/tokenBlacklist.js";
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshFamily,
  peekRefreshFamily,
  DEFAULT_REFRESH_EXPIRES_IN_SEC
} from "../auth/refreshTokenStore.js";
import {
  isPushConfigured,
  getVapidPublicKey,
  saveSubscription as savePushSubscription,
  removeSubscription as removePushSubscription,
  sendPushToUser
} from "../notifications/webPushService.js";
import { getWorkflowDefinition, applyTransition } from "../workflow/stateMachine.js";
import { fireWebhooks } from "../webhooks/webhookService.js";
import { createApiKey, listApiKeys, revokeApiKey, verifyApiKey, API_SCOPES } from "../auth/apiKeyService.js";
import { generateTotpSecret, verifyTotpToken, generateRecoveryCodes, verifyRecoveryCode } from "../auth/totpService.js";
import { mintShareToken, readShareTokenPayload } from "../share/token.js";
import { filterSnapshotForShare } from "../share/scope.js";
import {
  buildDropboxOAuthUrl,
  createDropboxOAuthState,
  exchangeDropboxOAuthCode,
  readDropboxOAuthState
} from "../dropbox/oauth.js";
import { resolveServerConfig, loadServerConfigFile, saveServerConfigFile } from "../config/serverConfig.js";
import { buildFileStore } from "../bootstrap/registerCloudProviders.js";
import {
  copyEntry, createFolder, listEntries, moveEntry, normalizeFileKey, removeEntries
} from "../files/fileStoreOperations.js";
import { secureOverwrite } from "../retention/secureDelete.js";
import {
  buildConfigView, validateDbConfig, mergeDbConfig, validateFileStoreConfig,
  mergeFileStoreConfig, testDatabaseConnection, testFileStoreConnection
} from "./adminConfig.js";
import { createRateLimiter, clientIp, userKeyFromHeader } from "./rateLimit.js";
import { captureException } from "../monitoring/sentryService.js";
import { listBackups, runBackup, restoreBackup, previewBackup } from "../backup/backupScheduler.js";
import { getPresetConfig } from "./presetConfig.js";
import {
  getMetricsOutput, getContentType,
  incActiveRequests, decActiveRequests, recordRequest
} from "../monitoring/metrics.js";
import { handleOcr } from "./ocrHandler.js";
import { handleControlRoute } from "./controlRoutes.js";
import { handleRightsRoute } from "./routes/rights.js";
import { publicOpenApiSpec } from "./publicOpenApi.js";
import { exportRecords } from "../export/exportService.js";
import { handleExportRoute } from "./routes/export.js";
import { createControlAgent } from "../control/controlAgent.js";
import { importPreviewService } from "../import/importPreview.js";
import { processImage, detectImageMimeType, PROCESSABLE_IMAGE_TYPES } from "../media/imageProcessor.js";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail, sendMail as defaultSendMail } from "../auth/emailService.js";
import { createResetToken, consumeResetToken } from "../auth/resetTokenStore.js";
import { notifyRecordShared, notifyUploadComplete } from "../notifications/notificationService.js";
import {
  initSession as initUploadSession,
  receiveChunk,
  completeSession as completeUploadSession,
  abortSession as abortUploadSession,
  sessionStatus as uploadSessionStatus,
  CHUNK_BYTES as UPLOAD_CHUNK_BYTES,
} from "./chunkedUpload.js";

// Minimal dependency-free HTTP server exposing the StorageProvider port to the
// SPA over a single RPC endpoint. Node's built-in http keeps the runtime image
// tiny and the attack surface small (no Express middleware chain).
//
// Routes:
//   GET    /api/health                  → { ok, backend, authRequired }
//   POST   /api/auth/login              → { ok, token, user }   body: { username, password[, totpToken] }
//   POST   /api/auth/refresh            → { ok, token, user }   (HttpOnly refresh cookie; rotates it)
//   POST   /api/auth/logout             → { ok }                (Bearer JWT required; kills refresh family)
//   POST   /api/auth/request-reset      → { ok, message }       body: { username }  (open; rate-limited)
//   POST   /api/auth/reset-password     → { ok, message }       body: { token, newPassword } (open; rate-limited)
//   POST   /api/auth/totp/setup         → { ok, otpauthUrl, qrUrl }  (Bearer required)
//   POST   /api/auth/totp/verify        → { ok }                body: { token }  (Bearer required; activates 2FA)
//   DELETE /api/auth/totp               → { ok }                body: { token }  (Bearer required; disables 2FA)
//   POST   /api/rpc                     → { ok, result } | { ok:false, error }
//                                         body: { method, args }   (Bearer JWT required when authSecret set)
//   POST   /api/export                  → binary file (CSV/XLSX/ZIP)
//                                         body: { format, store?, ids? }  (Bearer required)
//
// Auth: when `authSecret` is provided, /api/rpc requires a valid
// `Authorization: Bearer <jwt>`. /api/health and /api/auth/login stay open.
// When no secret is set the API is UNAUTHENTICATED — a loud warning is logged
// at startup (see src/index.js). The SPA's cloud-http adapter forwards each of
// its 11 methods to /api/rpc, so the contract never drifts from the port.

const MAX_BODY_BYTES = 256 * 1024 * 1024; // 256MB — matches nginx/Caddy limits.

const authLog = createLogger("auth");

function send(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? match[1].trim() : null;
}

// ── Refresh-token cookie (§20.1) ──────────────────────────────────────────────
// HttpOnly + Path=/api/auth keeps the refresh token out of JS and off every
// non-auth request; SameSite=Strict blocks cross-site sends.
const REFRESH_COOKIE = "va_refresh";

function parseCookies(req) {
  const out = {};
  const header = String(req.headers?.cookie || "");
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key) out[key] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function isSecureRequest(req) {
  if (req.socket?.encrypted) return true;
  return String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

function refreshCookieHeader(req, token, maxAgeSec) {
  const attrs = [
    `${REFRESH_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/api/auth",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`
  ];
  if (isSecureRequest(req)) attrs.push("Secure");
  return attrs.join("; ");
}

function clearRefreshCookieHeader(req) {
  return refreshCookieHeader(req, "", 0);
}

const SAFE_FILE_INFO_KEYS = new Set([
  "kind", "label", "rootPath", "rootDir", "bucket", "container",
  "prefix", "configured", "auth", "accountMode", "selectUser", "selectAdmin"
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
    temporaryUrl: typeof files?.getUrl === "function"
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
    health
  };
}

function safeDbError(error) {
  const message = error?.message || "Database ping failed";
  return String(message).replace(/:\/\/([^:/?#]+):([^@/?#]+)@/g, "://$1:***@");
}

async function buildDatabaseHealth(provider) {
  const started = Date.now();
  if (typeof provider?.ping !== "function") {
    return { ok: true, latencyMs: 0, skipped: true };
  }
  try {
    await provider.ping();
    return { ok: true, latencyMs: Math.max(0, Date.now() - started) };
  } catch (error) {
    return { ok: false, latencyMs: Math.max(0, Date.now() - started), error: safeDbError(error) };
  }
}

function requestOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim() || "http";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
  return `${proto}://${host}`;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

/**
 * Builds (but does not start) the HTTP server. Injectable deps keep it testable.
 *
 * @param {object} options
 * @param {string} [options.backend] - label returned by /api/health
 * @param {(req:object)=>Promise<unknown>} [options.dispatch] - RPC dispatcher
 * @param {string} [options.corsOrigin] - if set, adds permissive CORS for dev
 * @param {string} [options.authSecret] - JWT secret; when set, /api/rpc requires Bearer
 * @param {(body:object)=>Promise<{token,user}>} [options.login] - login handler
 * @param {object} [options.rateLimit] - { rpcMax, loginMax, windowMs }; set to null to disable
 */
export function createApiServer({
  backend = "unknown",
  dispatch = dispatchRpc,
  aiDispatch = dispatchAi,
  resolveFileStore = getFileStore,
  resolveSyncProvider = getSyncProvider,
  aiResolveProvider = getAiProvider,
  corsOrigin = "",
  authSecret = "",
  login,
  rateLimit = {},
  eventBus = null,
  mediaRootDir = process.env.FILE_STORE_DIR || ".archive-files",
  ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg",
  runExport = exportTimelineToMp4,
  checkFfmpeg = checkFfmpegAvailability,
  extraHealth = null,
  mediaJobStore = createInMemoryMediaJobStore(),
  mediaWorker = null,
  runMediaProbeImpl = runMediaProbe,
  runMediaDerivativeImpl = runMediaDerivative,
  resolveStorage = getStorageProvider,
  shareSecret = authSecret,
  shareExpiryDays = Number(process.env.SHARE_EXPIRY_DAYS) || 30,
  prisma = null,
  resolveConfig = resolveServerConfig,
  loadConfigFile = loadServerConfigFile,
  saveConfig = saveServerConfigFile,
  testDbConnection = testDatabaseConnection,
  buildFileStoreCandidate = buildFileStore,
  testFileStore = testFileStoreConnection,
  notificationSendMail = defaultSendMail,
  version = process.env.npm_package_version || process.env.APP_VERSION || "0.0.0",
  dropboxOAuthFetch,
  controlAgent = createControlAgent(),
  importPreview = importPreviewService
} = {}) {
  // Prefer dedicated per-token-type secrets; fall back to the legacy JWT_SECRET
  // (via authSecret/shareSecret) so existing deployments keep working.
  const resolvedAuthSecret   = process.env.JWT_AUTH_SECRET    || authSecret;
  const resolvedShareSecret  = process.env.JWT_SHARE_SECRET   || shareSecret;
  const resolvedOauthSecret  = process.env.OAUTH_STATE_SECRET || resolvedAuthSecret || resolvedShareSecret;

  const authRequired = Boolean(resolvedAuthSecret);
  const oauthSecret = resolvedOauthSecret;
  const refreshExpiresInSec = Number(process.env.REFRESH_EXPIRES_IN_SEC) || DEFAULT_REFRESH_EXPIRES_IN_SEC;
  const resolvedControlAgent = controlAgent && typeof controlAgent.status === "function"
    ? controlAgent
    : createControlAgent();
  let ffmpegHealthCache = null;

  const getFfmpegHealth = async () => {
    const now = Date.now();
    if (ffmpegHealthCache && now - ffmpegHealthCache.checkedAtMs < 30_000) return ffmpegHealthCache.value;
    const value = await checkFfmpeg({ ffmpegPath });
    ffmpegHealthCache = { checkedAtMs: now, value };
    return value;
  };

  // §16.15 — conversion service: persists derived_file records for every
  // media job created via /api/media/jobs. Gracefully no-ops when prisma=null.
  const conversionSvc = createConversionService({ db: prisma });
  if (eventBus) {
    eventBus.subscribe((payload) => {
      if (!payload?.type?.startsWith("media.job.")) return;
      const job = payload.job;
      if (!job?.id) return;
      const status = payload.type === "media.job.done" ? "done" : "error";
      conversionSvc.syncJobResult(job.id, { status, outputKey: job.outputKey, error: job.error }).catch(() => {});
    });
  }

  // §16.7 — share permission enforcement for protected actions on shared resources.
  const sharePermissionSvc = createSharePermissionService({ resolvedShareSecret });
  const shareInvitationSvc = createShareInvitationService({
    resolvedShareSecret,
    defaultExpiryDays: shareExpiryDays,
    sendMail: notificationSendMail,
    resolveStorage,
    db: prisma
  });

  // §20.5 security — the public API key endpoint may ONLY read these content
  // stores. An allowlist (not a denylist) keeps sensitive stores — users,
  // api_keys, webhooks, notification_preferences, push_subscriptions, config —
  // unreachable even if a new one is added later. Operators extend it via env.
  const PUBLIC_READABLE_STORES = new Set(
    String(process.env.PUBLIC_API_STORES || "video_items,media_items,document_items,audio_items,image_items")
      .split(",").map((s) => s.trim()).filter(Boolean)
  );

  // Rate limiters — five layers:
  //   rpc:        IP-based general RPC cap (100/min)
  //   user:       per-authenticated-user cap (60/min)
  //   ai:         per-IP cap for AI endpoints (30/min)
  //   ocr:        per-IP cap for OCR endpoint (10/min)
  //   login:      strict IP cap for login (10/min, brute-force defense)
  //   reset:      strict IP cap for password reset (5/min)
  //   totpDisable: strict IP cap for TOTP disable (3/15min)
  // Disabled entirely when rateLimit is null (e.g. some tests).
  const limiters = rateLimit === null ? null : {
    rpc:         createRateLimiter({ max: rateLimit.rpcMax  ?? 100, windowMs: rateLimit.windowMs ?? 60_000 }),
    user:        createRateLimiter({ max: rateLimit.userMax ?? 60,  windowMs: rateLimit.windowMs ?? 60_000 }),
    ai:          createRateLimiter({ max: rateLimit.aiMax   ?? 30,  windowMs: rateLimit.windowMs ?? 60_000 }),
    ocr:         createRateLimiter({ max: rateLimit.ocrMax  ?? 10,  windowMs: rateLimit.windowMs ?? 60_000 }),
    login:       createRateLimiter({ max: rateLimit.loginMax ?? 10, windowMs: rateLimit.windowMs ?? 60_000 }),
    reset:       createRateLimiter({ max: rateLimit.resetMax ?? 5,  windowMs: rateLimit.windowMs ?? 60_000 }),
    totpDisable: createRateLimiter({ max: 3, windowMs: 15 * 60_000 }),
    // §20.5 — per-API-key cap on the public read endpoint (keyed by key id,
    // independent of the caller IP so one key can't be amplified across hosts).
    apiKey:      createRateLimiter({ max: rateLimit.apiKeyMax ?? 120, windowMs: rateLimit.windowMs ?? 60_000 }),
  };

  function overLimit(res, bucket, req) {
    if (!limiters) return false;
    if (limiters[bucket].check(clientIp(req))) return false;
    send(res, 429, { ok: false, error: "Too many requests — slow down." });
    return true;
  }

  // Layer 2: per-user limit (keyed by JWT sub, does not re-verify signature).
  function overLimitUser(res, req) {
    if (!limiters) return false;
    const key = userKeyFromHeader(req);
    if (!key) return false; // unauthenticated paths skip user limit
    if (limiters.user.check(key)) return false;
    send(res, 429, { ok: false, error: "Too many requests — slow down." });
    return true;
  }

  function requireAuth(req, res) {
    if (!authRequired) return true;
    const token = bearerToken(req);
    try {
      if (!token) {
        const err = new Error("Authentication required."); err.statusCode = 401; throw err;
      }
      verifyJwt(token, resolvedAuthSecret);
      return true;
    } catch (error) {
      send(res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
      return false;
    }
  }

  function requireEditor(req, res) {
    if (!authRequired) return { sub: "anonymous", role: "owner" };
    const token = bearerToken(req);
    try {
      if (!token) {
        const err = new Error("Authentication required."); err.statusCode = 401; throw err;
      }
      const payload = verifyJwt(token, resolvedAuthSecret);
      if (!["admin", "owner", "editor"].includes(payload?.role)) {
        const err = new Error("Editor privileges required."); err.statusCode = 403; throw err;
      }
      return payload;
    } catch (error) {
      send(res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
      return null;
    }
  }

  // Admin-only gate for sensitive endpoints (DB config). When auth is disabled
  // (no secret) the whole API is unauthenticated, so this mirrors requireAuth.
  function requireAdmin(req, res) {
    if (!authRequired) return true;
    const token = bearerToken(req);
    try {
      if (!token) { const err = new Error("Authentication required."); err.statusCode = 401; throw err; }
      const payload = verifyJwt(token, resolvedAuthSecret);
      if (payload?.role !== "admin" && payload?.role !== "owner") {
        const err = new Error("Admin privileges required."); err.statusCode = 403; throw err;
      }
      return true;
    } catch (error) {
      send(res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
      return false;
    }
  }

  // Returns parsed JWT claims for any authenticated user, or sends 401 and
  // returns null. Used by TOTP management endpoints.
  function requireAuthClaims(req, res) {
    if (!authRequired) return { sub: "anonymous", username: "anonymous", role: "owner" };
    const token = bearerToken(req);
    try {
      if (!token) { const err = new Error("Authentication required."); err.statusCode = 401; throw err; }
      return verifyJwt(token, resolvedAuthSecret);
    } catch (error) {
      send(res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
      return null;
    }
  }

  let defaultMediaWorker = null;
  function getMediaWorker() {
    if (mediaWorker) return mediaWorker;
    if (!defaultMediaWorker) {
      defaultMediaWorker = createConversionJobRunner({
        store: mediaJobStore,
        eventBus,
        conversionService: conversionSvc,
        resolveFileStore,
        concurrency: Number(process.env.MEDIA_JOB_CONCURRENCY) || 1,
        runMediaDerivativeImpl,
        runExport,
        mediaRootDir
      });
    }
    return defaultMediaWorker;
  }

  return createServer(async (req, res) => {
    // Assign a request ID for correlation across logs.
    req.id = req.headers["x-request-id"] || randomUUID();
    res.setHeader("X-Request-Id", req.id);
    const reqLog = logger.child({ reqId: req.id, method: req.method, url: req.url });
    reqLog.debug({ ip: clientIp(req) }, "incoming request");

    // Prometheus: track active requests and record duration on response finish.
    // SSE connections never call res.end, so we also listen for req close as a
    // fallback to keep the active-request gauge accurate.
    incActiveRequests();
    const reqStart = Date.now();
    let metricsRecorded = false;
    function recordMetrics() {
      if (metricsRecorded) return;
      metricsRecorded = true;
      decActiveRequests();
      recordRequest(req.method, new URL(req.url || "/", "http://localhost").pathname, res.statusCode, (Date.now() - reqStart) / 1000);
    }
    const _origEnd = res.end.bind(res);
    res.end = function metricsEnd(...args) {
      res.end = _origEnd;
      const result = _origEnd(...args);
      recordMetrics();
      return result;
    };
    req.on("close", recordMetrics);

    // Dev CORS: the SPA on :8080 calling the API on another port. In prod the
    // nginx /api proxy keeps everything same-origin so this stays unset.
    if (corsOrigin) {
      res.setHeader("Access-Control-Allow-Origin", corsOrigin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
      // Refresh-token cookie (§20.1) must survive the cross-origin dev setup.
      res.setHeader("Access-Control-Allow-Credentials", "true");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
    }

    const requestUrl = new URL(req.url || "/", "http://localhost");
    const pathname = requestUrl.pathname;

    // ── API version routing ──────────────────────────────────────────
    // /api/v1/* is the canonical path going forward.
    // /api/* (without v1) is kept as a backward-compatible alias and receives
    // a Sunset header so operators know to migrate before 2028-01-01.
    let url;
    let isLegacyPath = false;
    if (pathname.startsWith("/api/v1/")) {
      // Canonical versioned path → normalise to /api/* for internal matching
      url = "/api/" + pathname.slice("/api/v1/".length);
    } else {
      // Unversioned path — still works, but is deprecated
      url = pathname;
      if (pathname.startsWith("/api/") && pathname !== "/api/") {
        isLegacyPath = true;
      }
    }

    // X-API-Version on every /api/ response
    if (pathname.startsWith("/api/")) {
      res.setHeader("X-API-Version", "1.0");
    }
    // Sunset + successor-version Link for legacy /api/* callers
    if (isLegacyPath) {
      res.setHeader("Sunset", "Sat, 01 Jan 2028 00:00:00 GMT");
      res.setHeader("Link", `</api/v1${pathname.slice("/api".length)}>; rel="successor-version"`);
    }

    // ── /api/ discovery endpoint ──────────────────────────────────────────
    if ((pathname === "/api/" || pathname === "/api/v1/") && req.method === "GET") {
      return send(res, 200, {
        version: "1.0",
        endpoints: {
          health: "/api/v1/health",
          publicOpenApi: "/api/v1/public/openapi.json",
          publicRecords: "/api/v1/public/records",
          rpc: "/api/v1/rpc",
          search: "/api/v1/search",
          auth: {
            login: "/api/v1/auth/login",
            logout: "/api/v1/auth/logout",
            requestReset: "/api/v1/auth/request-reset",
            totp: "/api/v1/auth/totp/setup",
          },
          share: "/api/v1/share",
          ocr: "/api/v1/ocr",
        },
      });
    }

    if (req.method === "GET" && url === "/api/public/openapi.json") {
      return send(res, 200, publicOpenApiSpec);
    }

    if (await handleControlRoute({
      req,
      res,
      url,
      requestUrl,
      authorizeAdmin: requireAdmin,
      sendJson: send,
      agent: resolvedControlAgent,
      overLimit,
      readJsonBody
    })) {
      return undefined;
    }

    if (req.method === "POST" && (url === "/api/import/preview" || url === "/api/v1/import/preview")) {
      if (overLimit(res, "rpc", req)) return undefined;
      const claims = requireEditor(req, res);
      if (!claims) return undefined;
      try {
        const body = await readJsonBody(req);
        const urls = Array.isArray(body?.urls)
          ? body.urls
          : String(body?.text || "").split(/[\s,]+/).filter(Boolean);
        const result = await importPreview({ urls, requestedBy: claims });
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Import preview failed" });
      }
    }

    if (req.method === "GET" && (url === "/api/health" || url === "/health")) {
      const config = resolveConfig();
      let db;
      let extras = {};
      try {
        db = await buildDatabaseHealth(resolveStorage());
      } catch (error) {
        db = { ok: false, latencyMs: 0, error: safeDbError(error) };
      }
      if (typeof extraHealth === "function") {
        try {
          extras = await extraHealth();
        } catch (error) {
          extras = { healthExtrasError: error?.message || "extra health failed" };
        }
      }
      return send(res, 200, {
        ok: true,
        backend,
        engine: backend === "pocketbase" ? "pocketbase" : config.databaseEngine || "postgresql",
        db,
        export: {
          mp4: {
            serverFfmpeg: await getFfmpegHealth(),
            wasmFallback: "client_optional"
          }
        },
        uptimeSec: Math.floor(process.uptime()),
        version,
        authRequired,
        ...extras
      });
    }

    // Setup status — open endpoint that tells the SPA whether first-run setup
    // is needed (i.e. no users have been created yet). Used by the frontend to
    // redirect to the FirstRunPage wizard on a fresh install.
    if (req.method === "GET" && url === "/api/setup/status") {
      try {
        const users = await resolveStorage().getAll("users").catch(() => []);
        return send(res, 200, { needsSetup: users.length === 0 });
      } catch {
        return send(res, 200, { needsSetup: false });
      }
    }

    // GET /api/setup/preset-config — returns a non-secret summary of the
    // server's .env configuration so the onboarding wizard can pre-fill setup
    // steps and offer a one-click "use existing settings" path.
    // Only accessible when setup is not yet complete (no users in the DB).
    if (req.method === "GET" && url === "/api/setup/preset-config") {
      try {
        const users = await resolveStorage().getAll("users").catch(() => []);
        if (users.length > 0) {
          return send(res, 403, { ok: false, error: "Setup already complete." });
        }
        const config = await getPresetConfig();
        return send(res, 200, { ok: true, config });
      } catch (err) {
        return send(res, 500, { ok: false, error: err?.message || "Failed to read preset config." });
      }
    }

    // GET /api/auth/me — returns the current user's profile (id, username, role,
    // totpEnabled). Requires Bearer auth. Used by the frontend 2FA settings panel.
    if (req.method === "GET" && url === "/api/auth/me") {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      try {
        const user = await resolveStorage().get("users", claims.sub);
        if (!user) return send(res, 404, { ok: false, error: "User not found." });
        return send(res, 200, {
          ok: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role || "editor",
            totpEnabled: !!user.totpEnabled,
            totpRecoveryCodesRemaining: user.totpRecoveryCodes?.length ?? 0,
          },
        });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Failed." });
      }
    }

    // First-run registration — only succeeds when no users exist yet.
    // After the first admin account is created, returns 403 to prevent
    // open registration. The wizard (FirstRunPage) posts here on fresh installs.
    if (req.method === "POST" && url === "/api/auth/register") {
      if (overLimit(res, "login", req)) return undefined;
      try {
        const body = await readJsonBody(req);
        const { username, email = "", password } = body || {};
        if (!username || typeof username !== "string" || username.trim().length < 3) {
          return send(res, 400, { ok: false, error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل." });
        }
        if (!password || typeof password !== "string" || password.length < 8) {
          return send(res, 400, { ok: false, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." });
        }
        const storage = resolveStorage();
        const existingUsers = await storage.getAll("users").catch(() => []);
        if (existingUsers.length > 0) {
          return send(res, 403, { ok: false, error: "التسجيل مغلق — يرجى تسجيل الدخول." });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const stamp = new Date().toISOString();
        const newUser = {
          id: `user_${Date.now().toString(36)}`,
          username: username.trim().slice(0, 50),
          email: String(email || "").trim().slice(0, 200),
          displayName: username.trim().slice(0, 50),
          role: "admin", // first user is always admin
          isActive: true,
          passwordHash,
          createdAt: stamp,
          updatedAt: stamp,
        };
        await storage.put("users", newUser);
        authLog.info({ event: "register", username: newUser.username, ip: clientIp(req) }, "AUDIT: first-run admin registered");
        if (!resolvedAuthSecret) {
          return send(res, 201, { ok: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
        }
        const token = signJwt(
          { sub: newUser.id, username: newUser.username, role: newUser.role },
          resolvedAuthSecret
        );
        return send(res, 201, { ok: true, token, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
      } catch (err) {
        logger.error({ err }, "register failed");
        return send(res, 500, { ok: false, error: "فشل إنشاء الحساب." });
      }
    }

    // Login — open endpoint that issues a token. 401 on bad credentials.
    if (req.method === "POST" && url === "/api/auth/login") {
      if (overLimit(res, "login", req)) return undefined;
      if (typeof login !== "function") {
        return send(res, 501, { ok: false, error: "Login not configured on this server." });
      }
      try {
        const body = await readJsonBody(req);
        const { username } = body || {};
        const result = await login(body);
        authLog.info({ event: "login", username, ip: clientIp(req) }, `AUDIT: login success`);
        // §20.1 — start a refresh-token family in an HttpOnly cookie so the
        // SPA can silently renew short-lived access tokens.
        if (resolvedAuthSecret && result?.user?.id) {
          const refresh = issueRefreshToken(
            { sub: result.user.id, username: result.user.username, role: result.user.role },
            resolvedAuthSecret,
            { expiresInSec: refreshExpiresInSec }
          );
          res.setHeader("Set-Cookie", refreshCookieHeader(req, refresh.token, refresh.expiresInSec));
        }
        return send(res, 200, { ok: true, ...result });
      } catch (error) {
        const statusCode = error?.statusCode || 500;
        return send(res, statusCode, { ok: false, error: error?.message || "Login failed" });
      }
    }

    // Refresh (§20.1) — rotate the HttpOnly refresh cookie and issue a fresh
    // short-lived access token. Reuse of a rotated token kills the family.
    if (req.method === "POST" && url === "/api/auth/refresh") {
      if (overLimit(res, "login", req)) return undefined;
      if (!authRequired) return send(res, 501, { ok: false, error: "Auth is not configured on this server." });
      const presented = parseCookies(req)[REFRESH_COOKIE];
      if (!presented) return send(res, 401, { ok: false, error: "لا توجد بطاقة تجديد." });
      try {
        const { token: nextRefresh, claims } = rotateRefreshToken(presented, resolvedAuthSecret, {
          expiresInSec: refreshExpiresInSec
        });
        const accessToken = signJwt(
          { sub: claims.sub, username: claims.username, role: claims.role },
          resolvedAuthSecret
        );
        res.setHeader("Set-Cookie", refreshCookieHeader(req, nextRefresh, refreshExpiresInSec));
        authLog.info({ event: "refresh", sub: claims.sub, username: claims.username, ip: clientIp(req) }, "AUDIT: token refreshed");
        return send(res, 200, {
          ok: true,
          token: accessToken,
          user: { id: claims.sub, username: claims.username, role: claims.role }
        });
      } catch (error) {
        res.setHeader("Set-Cookie", clearRefreshCookieHeader(req));
        if (error?.code === "REFRESH_REUSED") {
          authLog.warn({ event: "refresh_reuse", ip: clientIp(req) }, "AUDIT: refresh token reuse detected");
        }
        return send(res, error?.statusCode || 401, { ok: false, error: error?.message || "Refresh failed" });
      }
    }

    // Logout — revoke the caller's current token so it can no longer be used
    // even before its `exp` expires. Requires a valid Bearer token.
    if (req.method === "POST" && url === "/api/auth/logout") {
      if (!authRequired) return send(res, 200, { ok: true, message: "تم تسجيل الخروج بنجاح." });
      // §20.1 — kill the refresh family even if the access token is already
      // expired, and clear the cookie either way.
      const presentedRefresh = parseCookies(req)[REFRESH_COOKIE];
      if (presentedRefresh) revokeRefreshFamily(peekRefreshFamily(presentedRefresh));
      res.setHeader("Set-Cookie", clearRefreshCookieHeader(req));
      const token = bearerToken(req);
      if (!token) return send(res, 401, { ok: false, error: "Authentication required." });
      try {
        const claims = verifyJwt(token, resolvedAuthSecret);
        if (claims?.jti) revokeToken(claims.jti, claims.exp);
        authLog.info({ event: "logout", sub: claims?.sub, username: claims?.username, ip: clientIp(req) }, `AUDIT: logout`);
        return send(res, 200, { ok: true, message: "تم تسجيل الخروج بنجاح." });
      } catch (error) {
        // If the token is already expired/invalid we still treat it as a
        // successful logout — the token can't be used anyway.
        if (error?.code === "TOKEN_REVOKED" || error?.statusCode === 401) {
          return send(res, 200, { ok: true, message: "تم تسجيل الخروج بنجاح." });
        }
        return send(res, error?.statusCode || 401, { ok: false, error: error?.message || "Logout failed" });
      }
    }

    // Password reset — step 1: request a reset link by username.
    // Open endpoint; always returns 200 to prevent username enumeration.
    if (req.method === "POST" && url === "/api/auth/request-reset") {
      if (overLimit(res, "reset", req)) return undefined;
      try {
        const body = await readJsonBody(req);
        const { username } = body;
        const users = await resolveStorage().getAll("users").catch(() => []);
        const user = users.find(
          (u) => u.username?.toLowerCase() === String(username || "").toLowerCase() && u.isActive !== false
        );
        // Always return 200 even if user not found (prevent username enumeration)
        if (user && user.email) {
          const token = createResetToken(user.id, user.username, user.email);
          const baseUrl = process.env.APP_BASE_URL || `${requestOrigin(req)}`;
          const resetUrl = `${baseUrl}/reset-password?token=${token}`;
          await sendPasswordResetEmail({ to: user.email, resetUrl, username: user.username });
        }
        return send(res, 200, { ok: true, message: "إذا كان البريد الإلكتروني مسجلاً، ستصل رسالة خلال دقائق." });
      } catch (error) {
        // Still return 200 to prevent enumeration; log internally
        logger.warn({ err: error?.message }, "request-reset error");
        return send(res, 200, { ok: true, message: "إذا كان البريد الإلكتروني مسجلاً، ستصل رسالة خلال دقائق." });
      }
    }

    // Password reset — step 2: submit the token + new password.
    // Open endpoint; token is consumed (one-time use) on success.
    if (req.method === "POST" && url === "/api/auth/reset-password") {
      if (overLimit(res, "reset", req)) return undefined;
      try {
        const body = await readJsonBody(req);
        const { token, newPassword } = body;
        if (!token || !newPassword || newPassword.length < 8) {
          return send(res, 400, { ok: false, error: "البيانات غير صالحة. كلمة المرور يجب أن تكون 8 أحرف على الأقل." });
        }
        const data = consumeResetToken(token);
        if (!data) return send(res, 400, { ok: false, error: "رمز إعادة التعيين غير صالح أو منتهي الصلاحية." });

        // Fetch the full user record first — put() is an upsert that replaces the
        // entire record; writing only { id, passwordHash } would wipe all other fields.
        const storage = resolveStorage();
        const existingUser = await storage.get("users", data.userId);
        if (!existingUser) return send(res, 400, { ok: false, error: "المستخدم غير موجود." });

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await storage.put("users", { ...existingUser, passwordHash, updatedAt: new Date().toISOString() });
        return send(res, 200, { ok: true, message: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن." });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Password reset failed" });
      }
    }

    // ── 2FA / TOTP management (all require a valid Bearer token) ─────────────

    // POST /api/auth/totp/setup — generate a pending TOTP secret; scan QR then
    // call /verify to activate it. Does NOT enable 2FA yet.
    if (req.method === "POST" && url === "/api/auth/totp/setup") {
      if (overLimit(res, "rpc", req)) return undefined;
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      try {
        const { secret, otpauthUrl, qrUrl } = await generateTotpSecret(claims.username);
        await resolveStorage().put("users", { id: claims.sub, totpSecretPending: secret });
        return send(res, 200, { ok: true, otpauthUrl, qrUrl, message: "امسح رمز QR بتطبيق المصادقة ثم أدخل الرمز للتأكيد." });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "TOTP setup failed" });
      }
    }

    // POST /api/auth/totp/verify — confirm setup: verify a live code, promote
    // totpSecretPending → totpSecret, and set totpEnabled = true.
    if (req.method === "POST" && url === "/api/auth/totp/verify") {
      if (overLimit(res, "rpc", req)) return undefined;
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      try {
        const { token: totpCode } = await readJsonBody(req);
        const user = await resolveStorage().get("users", claims.sub);
        if (!user?.totpSecretPending) {
          return send(res, 400, { ok: false, error: "لا يوجد إعداد 2FA معلّق." });
        }
        if (!verifyTotpToken(user.totpSecretPending, totpCode)) {
          return send(res, 400, { ok: false, error: "رمز التحقق غير صحيح." });
        }
        const { plain: recoveryCodes, hashes: recoveryHashes } = await generateRecoveryCodes(8);
        await resolveStorage().put("users", {
          id: claims.sub,
          totpSecret: user.totpSecretPending,
          totpSecretPending: null,
          totpEnabled: true,
          totpRecoveryCodes: recoveryHashes,
        });
        // Return plain codes once — user must save them; hashes only are kept in DB.
        return send(res, 200, { ok: true, recoveryCodes, message: "تم تفعيل المصادقة الثنائية بنجاح. احفظ رموز الاسترداد في مكان آمن." });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "TOTP verify failed" });
      }
    }

    // DELETE /api/auth/totp — disable 2FA. Requires the current TOTP code to
    // prevent account takeover if a session token is stolen.
    if (req.method === "DELETE" && url === "/api/auth/totp") {
      if (overLimit(res, "totpDisable", req)) return undefined;
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      try {
        const { token: totpCode } = await readJsonBody(req);
        const user = await resolveStorage().get("users", claims.sub);
        if (user?.totpEnabled && !verifyTotpToken(user.totpSecret, totpCode)) {
          return send(res, 400, { ok: false, error: "رمز التحقق غير صحيح. أدخل الرمز الحالي لتعطيل 2FA." });
        }
        await resolveStorage().put("users", {
          id: claims.sub,
          totpSecret: null,
          totpSecretPending: null,
          totpEnabled: false,
          totpRecoveryCodes: null,
        });
        return send(res, 200, { ok: true, message: "تم تعطيل المصادقة الثنائية." });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "TOTP disable failed" });
      }
    }

    // POST /api/auth/totp/recover — consume a single-use recovery code in place
    // of a TOTP token. On success: removes the used hash and issues a new JWT.
    // Rate-limited to prevent brute-force against the 8 codes.
    if (req.method === "POST" && url === "/api/auth/totp/recover") {
      if (overLimit(res, "totpDisable", req)) return undefined;
      try {
        const { username, password, recoveryCode } = await readJsonBody(req);
        if (!username || !password || !recoveryCode) {
          return send(res, 400, { ok: false, error: "username و password و recoveryCode مطلوبة." });
        }
        // Re-use loginUser but skip TOTP check (we verify the recovery code ourselves).
        const storage = resolveStorage();
        const wantedUsername = String(username || "").trim().toLowerCase();
        let user;
        if (typeof storage.getByField === "function") {
          const found = await storage.getByField("users", "username", wantedUsername).catch(() => undefined);
          user = found?.isActive !== false ? found : undefined;
        } else {
          const users = await storage.getAll("users").catch(() => []);
          user = (users || []).find((u) => String(u?.username || "").trim().toLowerCase() === wantedUsername && u?.isActive !== false);
        }
        const { verifySecret } = await import("../auth/authService.js");
        const hash = user?.passwordHash || "$2a$12$0000000000000000000000000000000000000000000000000000";
        const passwordOk = await verifySecret(password, hash);
        if (!user || !passwordOk) {
          return send(res, 401, { ok: false, error: "بيانات الدخول غير صحيحة." });
        }
        if (!user.totpEnabled || !user.totpRecoveryCodes?.length) {
          return send(res, 400, { ok: false, error: "لا توجد رموز استرداد لهذا الحساب." });
        }
        const matchIndex = await verifyRecoveryCode(recoveryCode, user.totpRecoveryCodes);
        if (matchIndex === -1) {
          return send(res, 401, { ok: false, error: "رمز الاسترداد غير صحيح." });
        }
        // Consume the used code by removing it from the array.
        const remainingCodes = user.totpRecoveryCodes.filter((_, i) => i !== matchIndex);
        await storage.put("users", { id: user.id, totpRecoveryCodes: remainingCodes });
        const { signJwt: sign } = await import("../auth/jwt.js");
        const authSecret = config.authSecret;
        if (!authSecret) return send(res, 500, { ok: false, error: "Server misconfigured." });
        const claims = { sub: user.id, username: user.username, role: user.role || "editor" };
        const token = sign(claims, authSecret, { expiresInSec: config.jwtExpiresInSec });
        return send(res, 200, {
          ok: true,
          token,
          user: { id: user.id, username: user.username, role: claims.role },
          remainingRecoveryCodes: remainingCodes.length,
          message: remainingCodes.length === 0 ? "تم استخدام آخر رمز استرداد. يُنصح بتعطيل 2FA وإعادة تفعيله لتوليد رموز جديدة." : undefined,
        });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Recovery failed" });
      }
    }

    if (req.method === "POST" && url === "/api/rpc") {
      if (overLimit(res, "rpc", req)) return undefined;
      // Enforce Bearer auth when a secret is configured.
      if (!requireAuth(req, res)) return undefined;
      // Extract JWT claims for audit logging and RBAC enforcement.
      // When auth is disabled rpcClaims is null so dispatchRpc skips RBAC.
      const rpcClaims = authRequired
        ? (() => { try { return verifyJwt(bearerToken(req), resolvedAuthSecret) || {}; } catch { return {}; } })()
        : null;
      try {
        const body = await readJsonBody(req);
        const result = await dispatch(body, { user: rpcClaims });
        auditLog({
          method: body?.method,
          args: Array.isArray(body?.args) ? body.args : [],
          claims: rpcClaims,
          ip: clientIp(req),
          result: result !== null && typeof result === "object" ? { ok: true } : result,
        });
        return send(res, 200, { ok: true, result });
      } catch (error) {
        const statusCode = error?.statusCode || 500;
        if (statusCode >= 500) captureException(error, { endpoint: "rpc", reqId: req.id });
        return send(res, statusCode, { ok: false, error: error?.message || "RPC failed" });
      }
    }

    // AI proxy — the SPA's cloud-ai adapter calls this so provider keys stay
    // server-side. Allow-listed methods; 503 when no AI provider is configured.
    if (req.method === "POST" && url === "/api/ai/rpc") {
      if (overLimit(res, "ai", req)) return undefined;
      if (overLimitUser(res, req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const result = await aiDispatch(body);
        return send(res, 200, { ok: true, result });
      } catch (error) {
        const statusCode = error?.statusCode || 500;
        if (statusCode >= 500) captureException(error, { endpoint: "ai/rpc", reqId: req.id });
        return send(res, statusCode, { ok: false, error: error?.message || "AI request failed" });
      }
    }

    // Transcription — binary audio, so it can't ride the JSON AI RPC. The SPA
    // POSTs the raw audio blob with its Content-Type; we forward to the
    // configured Whisper provider via the registered AiProvider.transcribe.
    if (req.method === "POST" && url.split("?")[0] === "/api/ai/transcribe") {
      if (overLimit(res, "ai", req)) return undefined;
      if (overLimitUser(res, req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const provider = aiResolveProvider();
        if (typeof provider?.transcribe !== "function") {
          return send(res, 503, { ok: false, error: "التفريغ غير مُهيّأ على الخادم." });
        }
        const audio = await readRawBody(req);
        const mimeType = req.headers["content-type"] || "audio/mpeg";
        const name = decodeURIComponent(req.headers["x-filename"] || "audio");
        const result = await provider.transcribe({ blob: audio, mimeType, name });
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Transcription failed" });
      }
    }

    // Project MP4 export — renders a timeline via ffmpeg (bundled in the same
    // Docker image). Body: { timeline }. Streams the resulting MP4 back. The
    // clip sources must be available under the media root (uploaded files).
    if (req.method === "POST" && url.split("?")[0] === "/api/projects/export") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      let outFile;
      try {
        const body = await readJsonBody(req);
        const timeline = body?.timeline;
        if (!timeline || !Array.isArray(timeline.clips) || !timeline.clips.length) {
          return send(res, 400, { ok: false, error: "حمولة timeline غير صالحة أو فارغة." });
        }
        const result = await runExport(timeline, { rootDir: mediaRootDir, ffmpegPath });
        outFile = result.output;
        const { createReadStream, statSync } = await import("node:fs");
        const size = statSync(outFile).size;
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Length": size,
          "Content-Disposition": `attachment; filename="${(timeline.project?.name || "export").replace(/[^\w.-]/g, "_")}.mp4"`
        });
        const stream = createReadStream(outFile);
        stream.pipe(res);
        await new Promise((resolve) => { stream.on("close", resolve); stream.on("error", resolve); });
        return undefined;
      } catch (error) {
        const statusCode = error?.statusCode || 500;
        if (statusCode >= 500) captureException(error, { endpoint: "projects/export", reqId: req.id });
        return send(res, statusCode, { ok: false, error: error?.message || "Export failed", code: error?.code || "EXPORT_FAILED" });
      } finally {
        if (outFile) { try { (await import("node:fs")).unlinkSync(outFile); } catch { /* temp cleanup best-effort */ } }
      }
    }

    if (req.method === "POST" && url.split("?")[0] === "/api/media/probe") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireEditor(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const result = await runMediaProbeImpl({
          key: body?.key,
          fileStore: resolveFileStore()
        });
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Media probe failed", code: error?.code });
      }
    }

    const derivativeRoutes = {
      "/api/media/thumbnail": "thumbnail",
      "/api/media/audio": "audio",
      "/api/media/preview": "preview"
    };
    if (req.method === "POST" && Object.hasOwn(derivativeRoutes, url.split("?")[0])) {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireEditor(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const { key, ...params } = body || {};
        const result = await runMediaDerivativeImpl({
          type: derivativeRoutes[url.split("?")[0]],
          key,
          params,
          fileStore: resolveFileStore()
        });
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Media operation failed", code: error?.code });
      }
    }

    if (req.method === "POST" && url.split("?")[0] === "/api/media/jobs") {
      if (overLimit(res, "rpc", req)) return undefined;
      const user = requireEditor(req, res);
      if (!user) return undefined;
      try {
        const body = await readJsonBody(req);
        const type = body?.type === "montage" ? "montage" : "transcode";
        const sourceKey = body?.sourceKey || body?.key || "";
        if (type === "transcode" && !sourceKey) {
          return send(res, 400, { ok: false, error: "مفتاح الملف مطلوب لمهمة التحويل." });
        }
        if (type === "montage" && !body?.timeline) {
          return send(res, 400, { ok: false, error: "حمولة timeline مطلوبة لمهمة المونتاج." });
        }
        const { key, sourceKey: _sourceKey, type: _type, ...params } = body || {};
        const job = mediaJobStore.create({
          type,
          sourceKey,
          params,
          requestedBy: user.sub || user.username || ""
        });
        conversionSvc.requestConversion({
          sourceItemId: params?.itemId ?? null,
          sourceKey,
          conversionType: params?.format || type,
          label: params?.outputLabel || type,
          jobId: job.id,
          createdBy: user.sub || user.username || ""
        }).catch(() => {});
        Promise.resolve(getMediaWorker().pump()).catch(() => {});
        return send(res, 200, { ok: true, result: { jobId: job.id, job } });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Media job failed" });
      }
    }

    if (req.method === "GET" && url.split("?")[0] === "/api/media/jobs") {
      if (!requireEditor(req, res)) return undefined;
      return send(res, 200, { ok: true, result: mediaJobStore.list() });
    }

    if (url.split("?")[0].startsWith("/api/media/jobs/")) {
      const parts = url.split("?")[0].slice("/api/media/jobs/".length).split("/");
      const id = decodeURIComponent(parts[0] || "");
      if (!id) return send(res, 400, { ok: false, error: "معرّف المهمة مطلوب." });
      if (req.method === "GET" && parts.length === 1) {
        if (!requireEditor(req, res)) return undefined;
        const job = mediaJobStore.get(id);
        return job ? send(res, 200, { ok: true, result: job }) : send(res, 404, { ok: false, error: "المهمة غير موجودة." });
      }
      if (req.method === "POST" && parts[1] === "retry") {
        if (overLimit(res, "rpc", req)) return undefined;
        if (!requireEditor(req, res)) return undefined;
        const job = mediaJobStore.retry(id);
        if (!job) return send(res, 400, { ok: false, error: "لا يمكن إعادة محاولة هذه المهمة." });
        Promise.resolve(getMediaWorker().pump()).catch(() => {});
        return send(res, 200, { ok: true, result: job });
      }
    }

    // §16.15 — Derived files list for an item or storage key.
    // GET /api/media/derived?sourceItemId=<id>  OR  ?sourceKey=<key>
    if (req.method === "GET" && url.split("?")[0] === "/api/media/derived") {
      if (!requireAuth(req, res)) return undefined;
      const params = new URLSearchParams(url.includes("?") ? url.slice(url.indexOf("?") + 1) : "");
      const sourceItemId = params.get("sourceItemId") || "";
      const sourceKey = params.get("sourceKey") || "";
      if (!sourceItemId && !sourceKey) {
        return send(res, 400, { ok: false, error: "sourceItemId أو sourceKey مطلوب." });
      }
      try {
        const files = sourceItemId
          ? await conversionSvc.listForItem(sourceItemId)
          : await conversionSvc.listForKey(sourceKey);
        return send(res, 200, { ok: true, result: files.map((f) => ({
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
          completedAt: f.completedAt
        })) });
      } catch {
        return send(res, 500, { ok: false, error: "فشل جلب الملفات المشتقة." });
      }
    }

    // Scoped sharing (G6) — mint a signed public share link. Auth + rate-limited.
    // Body: { scope: { type: "all"|"items"|"collection", ids?: [], label? },
    //         sharedWithUserId?: string }  — optional for user-to-user share notifications.
    if (req.method === "POST" && url.split("?")[0] === "/api/share") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const expiresInDays = Object.hasOwn(body || {}, "expiresInDays") ? Number(body.expiresInDays) : shareExpiryDays;
        const title = body?.title || body?.scope?.label || "";
        const token = mintShareToken({ scope: body?.scope, secret: resolvedShareSecret, expiresInDays, title, password: body?.password });
        const payload = readShareTokenPayload(token, resolvedShareSecret, { password: body?.password });
        const shareUrl = `${requestOrigin(req)}/api/share/${token}`;

        // Fire-and-forget email to the recipient (if caller specified a target user).
        if (body?.sharedWithUserId) {
          const senderClaims = (() => { try { return verifyJwt(bearerToken(req), resolvedAuthSecret); } catch { return null; } })();
          notifyRecordShared({
            prisma,
            sendMail: notificationSendMail,
            sharedWithUserId: body.sharedWithUserId,
            sharedByUsername: senderClaims?.username,
            recordTitle: title,
            shareUrl,
          });
          sendPushToUser({
            prisma,
            userId: body.sharedWithUserId,
            type: "share",
            title: `تمت مشاركة سجل معك — ${title || "سجل جديد"}`,
            body: senderClaims?.username ? `شاركه معك ${senderClaims.username}` : "",
            url: shareUrl,
          });
        }

        return send(res, 200, { ok: true, result: { token, path: `/api/share/${token}`, title: payload.title, expiresAt: payload.expiresAt, jti: payload.jti, passwordProtected: payload.passwordProtected } });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Failed to create share link" });
      }
    }

    // Email invitation for a scoped share link. Auth + rate-limited.
    // Body: { email, scope, title?, message?, expiresInDays?, password? }
    if (req.method === "POST" && url.split("?")[0] === "/api/share/invitations") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const senderClaims = (() => { try { return verifyJwt(bearerToken(req), resolvedAuthSecret); } catch { return null; } })();
        const result = await shareInvitationSvc.createInvitation({
          email: body?.email,
          scope: body?.scope,
          title: body?.title || body?.scope?.label || "",
          message: body?.message || "",
          password: body?.password || "",
          expiresInDays: Object.hasOwn(body || {}, "expiresInDays") ? Number(body.expiresInDays) : shareExpiryDays,
          origin: requestOrigin(req),
          sender: senderClaims
        });
        return send(res, 201, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Failed to create share invitation" });
      }
    }

    // Revoke a share link by jti (admin/owner only, Postgres only).
    // Body: { jti }
    if (req.method === "POST" && url.split("?")[0] === "/api/share/revoke") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAdmin(req, res)) return undefined;
      if (!prisma) {
        return send(res, 501, { ok: false, error: "إلغاء الروابط غير متاح في هذا الإعداد." });
      }
      try {
        const body = await readJsonBody(req);
        const jti = String(body?.jti || "").trim();
        if (!jti) return send(res, 400, { ok: false, error: "jti مطلوب." });
        await prisma.shareRevocation.upsert({
          where: { jti },
          create: { jti },
          update: {}
        });
        return send(res, 200, { ok: true, result: { revoked: true, jti } });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Failed to revoke share link" });
      }
    }

    // Public read of a share link — NO auth. Returns a privacy-safe, scoped,
    // read-only snapshot (in-scope non-deleted items + reference data only).
    if (req.method === "GET" && url.split("?")[0].startsWith("/api/share/")) {
      if (overLimit(res, "rpc", req)) return undefined;
      const token = decodeURIComponent(url.split("?")[0].slice("/api/share/".length));
      try {
        const share = readShareTokenPayload(token, resolvedShareSecret, { password: req.headers["x-share-password"] });
        // Check revocation (Postgres only; no-op on PocketBase).
        if (prisma && share.jti) {
          const revoked = await prisma.shareRevocation.findUnique({ where: { jti: share.jti } });
          if (revoked) return send(res, 401, { ok: false, error: "رابط المشاركة مُلغى." });
        }
        const snapshot = await resolveStorage().snapshot();
        return send(res, 200, { ok: true, result: filterSnapshotForShare(snapshot, share.scope, share) });
      } catch (error) {
        return send(res, error?.statusCode || 404, { ok: false, error: error?.message || "Share link not found" });
      }
    }

    // §16.7 — Share-access: verify capabilities and perform permission-gated actions.
    // GET  /api/share-access?shareToken=<token>  → returns capabilities
    // POST /api/share-access/comments            → post comment via share link (canComment)
    if (req.method === "GET" && url.split("?")[0] === "/api/share-access") {
      if (overLimit(res, "rpc", req)) return undefined;
      const check = sharePermissionSvc.fromRequest(req, { password: req.headers["x-share-password"] });
      if (!check.ok) return send(res, check.status, { ok: false, error: check.error });
      const caps = sharePermissionSvc.capabilities(check.payload);
      return send(res, 200, { ok: true, result: { permission: check.payload.scope?.permission || "view", capabilities: caps } });
    }

    if (req.method === "POST" && url.split("?")[0] === "/api/share-access/comments") {
      if (overLimit(res, "rpc", req)) return undefined;
      const check = sharePermissionSvc.fromRequest(req, { password: req.headers["x-share-password"] });
      if (!check.ok) return send(res, check.status, { ok: false, error: check.error });
      if (!sharePermissionSvc.allows(check.payload, "canComment")) {
        return send(res, 403, { ok: false, error: "رابط المشاركة لا يمنح صلاحية التعليق." });
      }
      try {
        const body = await readJsonBody(req);
        const itemId = String(body?.itemId || "").trim();
        const text = String(body?.text || body?.content || "").trim();
        const authorName = String(body?.authorName || "").trim().slice(0, 80) || "زائر";
        if (!itemId) return send(res, 400, { ok: false, error: "معرّف العنصر مطلوب." });
        if (!text) return send(res, 400, { ok: false, error: "نص التعليق مطلوب." });
        if (!sharePermissionSvc.scopeIncludesItem(check.payload, itemId)) {
          return send(res, 403, { ok: false, error: "العنصر ليس ضمن نطاق هذا الرابط." });
        }
        const comment = {
          id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          itemId,
          text: text.slice(0, 4000),
          authorName,
          authorType: "share_link",
          shareJti: check.payload.jti || "",
          createdAt: new Date().toISOString()
        };
        // Persist via storage if available (best-effort).
        try {
          if (prisma?.shareComment && typeof prisma.shareComment.create === "function") {
            await prisma.shareComment.create({
              data: {
                id: comment.id,
                itemId: comment.itemId,
                text: comment.text,
                authorName: comment.authorName,
                authorType: comment.authorType,
                shareJti: comment.shareJti || null,
                createdAt: new Date(comment.createdAt)
              }
            });
          } else {
            const storage = resolveStorage();
            await storage.put?.("share_comments", comment);
          }
        } catch {
          // no-op: local/SPA backends may not support share_comments store
        }
        return send(res, 201, { ok: true, result: comment });
      } catch (err) {
        return send(res, 400, { ok: false, error: err?.message || "فشل حفظ التعليق." });
      }
    }

    // ── Admin: database configuration (admin/owner only) ──
    if (req.method === "POST" && url.split("?")[0] === "/api/admin/dropbox/oauth/start") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAdmin(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const cfg = resolveConfig();
        const appKey = String(body?.appKey || cfg.dropboxAppKey || process.env.DROPBOX_APP_KEY || "").trim();
        const redirectUri = String(body?.redirectUri || process.env.DROPBOX_REDIRECT_URI || `${requestOrigin(req)}/api/dropbox/oauth/callback`).trim();
        const state = createDropboxOAuthState({
          secret: oauthSecret,
          rootPath: body?.rootPath ?? cfg.dropboxRootPath ?? "",
          selectUser: body?.selectUser ?? cfg.dropboxSelectUser ?? "",
          selectAdmin: body?.selectAdmin ?? cfg.dropboxSelectAdmin ?? "",
          redirectUri,
          returnTo: body?.returnTo || `${requestOrigin(req)}/?page=settings&dropbox=connected`
        });
        const authUrl = buildDropboxOAuthUrl({
          appKey,
          redirectUri,
          state,
          forceReapprove: Boolean(body?.forceReapprove)
        });
        return send(res, 200, { ok: true, result: { authUrl, redirectUri } });
      } catch (error) {
        return send(res, error?.statusCode || 400, { ok: false, error: error?.message || "Dropbox OAuth start failed" });
      }
    }

    if (req.method === "GET" && url.split("?")[0] === "/api/dropbox/oauth/callback") {
      try {
        const code = requestUrl.searchParams.get("code") || "";
        const state = readDropboxOAuthState(requestUrl.searchParams.get("state") || "", oauthSecret);
        const cfg = resolveConfig();
        const token = await exchangeDropboxOAuthCode({
          code,
          appKey: cfg.dropboxAppKey || process.env.DROPBOX_APP_KEY,
          appSecret: cfg.dropboxAppSecret || process.env.DROPBOX_APP_SECRET,
          redirectUri: state.redirectUri,
          fetchImpl: dropboxOAuthFetch
        });
        const merged = mergeFileStoreConfig(loadConfigFile(), {
          kind: "dropbox",
          dropbox: {
            accessToken: token.accessToken,
            accessTokenExpiresAt: token.expiresAt,
            refreshToken: token.refreshToken,
            rootPath: state.rootPath,
            selectUser: state.selectUser,
            selectAdmin: state.selectAdmin
          }
        });
        saveConfig(merged);
        const target = new URL(state.returnTo || "/", requestOrigin(req));
        target.searchParams.set("dropbox", "connected");
        return redirect(res, target.toString());
      } catch (error) {
        return send(res, error?.statusCode || 400, { ok: false, error: error?.message || "Dropbox OAuth callback failed" });
      }
    }

    // View the active DB target (password masked).
    if (req.method === "GET" && url.split("?")[0] === "/api/admin/config") {
      if (!requireAdmin(req, res)) return undefined;
      return send(res, 200, { ok: true, result: buildConfigView(resolveConfig()) });
    }
    // Test a candidate connection string WITHOUT saving it.
    if (req.method === "POST" && url.split("?")[0] === "/api/admin/db/test") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAdmin(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const candidate = validateDbConfig(body);
        const result = await testDbConnection(candidate);
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Test failed" });
      }
    }
    // Persist runtime config changes → applied on the next restart.
    if (req.method === "POST" && url.split("?")[0] === "/api/admin/config") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAdmin(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        let merged = loadConfigFile();
        let changed = false;
        if (Object.hasOwn(body || {}, "database")) {
          const candidate = validateDbConfig(body?.database);
          merged = mergeDbConfig(merged, candidate);
          changed = true;
        }
        if (Object.hasOwn(body || {}, "fileStore")) {
          const candidate = validateFileStoreConfig(body?.fileStore);
          merged = mergeFileStoreConfig(merged, candidate);
          changed = true;
        }
        if (!changed) {
          return send(res, 400, { ok: false, error: "لا توجد إعدادات قابلة للحفظ." });
        }
        saveConfig(merged);
        const view = buildConfigView(resolveConfig({ file: merged, env: {} }));
        return send(res, 200, { ok: true, result: { saved: true, restartRequired: true, ...view } });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Save failed" });
      }
    }

    if (req.method === "POST" && url.split("?")[0] === "/api/files/test-provider") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAdmin(req, res)) return undefined;
      try {
        const candidate = validateFileStoreConfig(await readJsonBody(req));
        const merged = mergeFileStoreConfig(loadConfigFile(), candidate);
        const resolved = resolveConfig({ file: merged, env: process.env });
        const store = buildFileStoreCandidate({
          fileStore: candidate.kind,
          fileStoreOptions: resolved.fileStoreOptions,
          resolveConfig: () => resolved
        });
        const result = await testFileStore(store);
        return send(res, result.ok ? 200 : 502, { ok: result.ok, result, ...(result.ok ? {} : { error: result.error }) });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "FileStore test failed" });
      }
    }

    if (url === "/api/files" && req.method === "GET") {
      if (!requireAuth(req, res)) return undefined;
      try {
        const result = await resolveFileStore().list(requestUrl.searchParams.get("prefix") || "");
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File list failed" });
      }
    }

    if (url === "/api/files/status" && req.method === "GET") {
      if (!requireAuth(req, res)) return undefined;
      try {
        const result = await buildFileStoreStatus(resolveFileStore());
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File status failed" });
      }
    }

    if (url === "/api/files/browser" && req.method === "GET") {
      if (!requireAuth(req, res)) return undefined;
      try {
        const result = await listEntries(resolveFileStore(), requestUrl.searchParams.get("path") || "", {
          query: requestUrl.searchParams.get("query") || "",
          limit: Math.min(200, Number(requestUrl.searchParams.get("limit")) || 200),
          cursor: requestUrl.searchParams.get("cursor") || ""
        });
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File browse failed", details: { code: "FILE_BROWSE_FAILED", provider: resolveFileStore()?.describe?.().kind || "unknown", retryable: (error?.statusCode || 500) >= 500 } });
      }
    }

    if (url === "/api/files/folders" && req.method === "POST") {
      if (!requireEditor(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const result = await createFolder(resolveFileStore(), body?.path);
        return send(res, 201, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Folder creation failed" });
      }
    }

    if (url === "/api/files/actions" && req.method === "POST") {
      if (!requireEditor(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const action = String(body?.action || "").toLowerCase();
        const store = resolveFileStore();
        if (action === "delete") {
          return send(res, 200, { ok: true, result: { action, results: await removeEntries(store, body?.keys || []) } });
        }
        if (action === "rename") {
          const source = normalizeFileKey(body?.key);
          const name = normalizeFileKey(body?.name);
          if (name.includes("/")) return send(res, 400, { ok: false, error: "اسم الملف الجديد يجب ألا يحتوي على مسار." });
          const parent = source.includes("/") ? source.slice(0, source.lastIndexOf("/")) : "";
          const destination = parent ? `${parent}/${name}` : name;
          const value = await moveEntry(store, source, destination);
          return send(res, 200, { ok: true, result: { action, results: [{ key: source, destination, ok: true, value }] } });
        }
        if (action === "copy" || action === "move") {
          const destinationFolder = normalizeFileKey(body?.destination, { allowEmpty: true });
          const results = [];
          for (const rawKey of body?.keys || []) {
            const key = normalizeFileKey(rawKey);
            const name = key.slice(key.lastIndexOf("/") + 1);
            const destination = destinationFolder ? `${destinationFolder}/${name}` : name;
            try {
              const value = action === "copy" ? await copyEntry(store, key, destination) : await moveEntry(store, key, destination);
              results.push({ key, destination, ok: true, value });
            } catch (error) {
              results.push({ key, destination, ok: false, error: error?.message || `${action} failed` });
            }
          }
          return send(res, 200, { ok: true, result: { action, results } });
        }
        return send(res, 400, { ok: false, error: "عملية الملفات غير مدعومة." });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File action failed" });
      }
    }

    if (url === "/api/files/url" && req.method === "GET") {
      if (!requireAuth(req, res)) return undefined;
      try {
        const key = requestUrl.searchParams.get("key") || "";
        if (!key) return send(res, 400, { ok: false, error: "File key is required." });
        const files = resolveFileStore();
        if (typeof files?.getUrl !== "function") {
          return send(res, 501, { ok: false, error: "File URL lookup is not supported." });
        }
        const result = await files.getUrl(key);
        if (!result) return send(res, 404, { ok: false, error: "File URL not found." });
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File URL lookup failed" });
      }
    }

    if (url.startsWith("/api/files/")) {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      const key = decodeURIComponent(url.slice("/api/files/".length));
      try {
        const files = resolveFileStore();
        if (req.method === "PUT") {
          const declaredMime = req.headers["content-type"] || "";

          // Image types need a Buffer so we can run the Sharp processing pipeline
          // (detect MIME from magic bytes, generate srcset variants).
          // Everything else — video, audio, archives, binary blobs — streams directly
          // to the file store without ever being fully held in memory.
          let result;
          let imageMetadata = null;

          if (PROCESSABLE_IMAGE_TYPES.has(declaredMime)) {
            // Buffer path: images only (typically <20 MB; bounded by content-type)
            const bytes = await readRawBody(req);
            const detectedMime = detectImageMimeType(bytes) || declaredMime;

            // Run image processing pipeline for supported image types.
            // Stores srcset-ready WebP variants alongside the original.
            // Gracefully no-ops if Sharp is unavailable or the file is not an image.
            if (PROCESSABLE_IMAGE_TYPES.has(detectedMime)) {
              const { variants, metadata } = await processImage(bytes, detectedMime);
              imageMetadata = metadata;
              // Store each variant under a predictable key: <original-key>@<name>.webp
              for (const variant of variants) {
                const variantKey = `${key}@${variant.name}.webp`;
                try {
                  await files.putBlob(variantKey, variant.buffer, { contentType: "image/webp" });
                } catch (variantErr) {
                  // Variant storage failures are non-fatal — log and continue.
                  reqLog.warn({ variantKey, err: variantErr?.message }, "Image variant storage failed");
                }
              }
            }

            result = await files.putBlob(key, bytes, { contentType: declaredMime });
          } else {
            // Stream path: pass the request body directly to the store.
            // putStream is preferred; putBlob with a stream works for adapters
            // that accept Readable (disk, S3 multipart, etc.).
            if (typeof files.putStream === "function") {
              result = await files.putStream(key, req, { contentType: declaredMime });
            } else {
              result = await files.putBlob(key, req, { contentType: declaredMime });
            }
          }
          notifyUploadComplete({
            prisma,
            sendMail: notificationSendMail,
            userId: claims.sub,
            recordTitle: key,
          });
          sendPushToUser({
            prisma,
            userId: claims.sub,
            type: "upload",
            title: `اكتملت معالجة الملف — ${key}`,
            url: "/",
          });
          return send(res, 200, {
            ok: true,
            result,
            ...(imageMetadata ? { imageMetadata } : {}),
          });
        }
        if (req.method === "GET") {
          const blob = await files.getBlob(key);
          if (!blob) return send(res, 404, { ok: false, error: "File not found." });
          const bytes = Buffer.isBuffer(blob) ? blob : Buffer.from(await blob.arrayBuffer());
          res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Length": bytes.length
          });
          res.end(bytes);
          return undefined;
        }
        if (req.method === "DELETE") {
          // Attempt DoD 5220.22-M secure wipe when the store is disk-backed.
          // Cloud stores (S3, Azure, etc.) have no local path — fall back to
          // the standard remove() which calls the provider's own delete API.
          let secureResult = null;
          const storeInfo = typeof files.describe === "function" ? files.describe() : {};
          if (storeInfo.kind === "disk" && storeInfo.rootDir) {
            const nodePath = await import("node:path");
            const localPath = nodePath.default.resolve(storeInfo.rootDir, key.replace(/\//g, nodePath.default.sep));
            try {
              secureResult = await secureOverwrite(localPath);
              // File is already unlinked by secureOverwrite — log chain-of-custody.
              auditLog({
                method: "secure-delete",
                args: [key],
                claims: claims || {},
                ip: clientIp(req),
                result: {
                  fileSizeBytes: secureResult.fileSizeBytes,
                  passes: secureResult.passes,
                  skipped: secureResult.skipped || false,
                },
              });
            } catch (wipeErr) {
              // If the file doesn't exist locally, fall through to files.remove().
              reqLog.warn({ key, err: wipeErr?.message }, "secureOverwrite failed — falling back to standard remove");
              await files.remove(key);
            }
          } else {
            await files.remove(key);
          }
          return send(res, 200, { ok: true, result: true, secureDelete: secureResult !== null });
        }
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File operation failed" });
      }
    }

    // ── Chunked / resumable upload sessions ────────────────────────────────
    // POST   /api/upload-sessions                  → init session
    // GET    /api/upload-sessions/:id/status       → received chunks list (resume support)
    // PUT    /api/upload-sessions/:id/chunks/:idx  → receive one chunk
    // POST   /api/upload-sessions/:id/complete     → assemble → FileStore
    // DELETE /api/upload-sessions/:id              → abort
    if (url === "/api/upload-sessions" && req.method === "POST") {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      try {
        const body = await readJsonBody(req);
        const { key, contentType, totalSize, totalChunks } = body || {};
        const result = await initUploadSession({
          key,
          contentType,
          totalSize: Number(totalSize),
          totalChunks: Number(totalChunks),
          userId: claims.sub,
        });
        return send(res, 201, { ok: true, ...result, chunkSize: UPLOAD_CHUNK_BYTES });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message });
      }
    }

    if (url.startsWith("/api/upload-sessions/")) {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      // Parse: /api/upload-sessions/{uploadId}/...
      const rest = url.slice("/api/upload-sessions/".length);
      const slashIdx = rest.indexOf("/");
      const uploadId = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
      const subPath = slashIdx === -1 ? "" : rest.slice(slashIdx + 1);

      try {
        if (req.method === "GET" && subPath === "status") {
          const result = uploadSessionStatus({ uploadId, userId: claims.sub });
          return send(res, 200, { ok: true, ...result });
        }

        if (req.method === "PUT" && subPath.startsWith("chunks/")) {
          const chunkIndex = parseInt(subPath.slice("chunks/".length), 10);
          // Pass req as a Readable stream — receiveChunk streams it directly to disk
          const result = await receiveChunk({ uploadId, chunkIndex, data: req, userId: claims.sub });
          return send(res, 200, { ok: true, ...result });
        }

        if (req.method === "POST" && subPath === "complete") {
          const files = resolveFileStore();
          const result = await completeUploadSession({ uploadId, userId: claims.sub, files });
          notifyUploadComplete({
            prisma,
            sendMail: notificationSendMail,
            userId: claims.sub,
            recordTitle: result?.key || uploadId,
          });
          sendPushToUser({
            prisma,
            userId: claims.sub,
            type: "upload",
            title: `اكتمل الرفع — ${result?.key || uploadId}`,
            url: "/",
          });
          return send(res, 200, { ok: true, result });
        }

        if (req.method === "DELETE" && !subPath) {
          const result = await abortUploadSession({ uploadId, userId: claims.sub });
          return send(res, 200, { ok: true, ...result });
        }

        return send(res, 404, { ok: false, error: "Not found" });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message });
      }
    }
    // ── End chunked upload ──────────────────────────────────────────────────

    if (url === "/api/sync/push" && req.method === "POST") {
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const result = await resolveSyncProvider().pushChange(body);
        // Fan the change out to every connected SSE client so other devices
        // apply it live. Best-effort — a failed broadcast never fails the push.
        if (eventBus) eventBus.publish({ type: "change", change: body });
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Sync push failed" });
      }
    }

    // Realtime sync stream (SSE). EventSource can't set headers, so the JWT is
    // passed as ?token= (validated below). The connection stays open and each
    // pushed change is streamed as `data: {...}`. A heartbeat keeps proxies
    // from closing an idle stream.
    if (url.split("?")[0] === "/api/sync/events" && req.method === "GET") {
      if (authRequired) {
        const token = bearerToken(req) || requestUrl.searchParams.get("token");
        try {
          if (!token) { const e = new Error("Authentication required."); e.statusCode = 401; throw e; }
          verifyJwt(token, resolvedAuthSecret);
        } catch (error) {
          return send(res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
        }
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no" // tell nginx not to buffer the stream
      });
      res.write(": connected\n\n");
      const unsubscribe = eventBus
        ? eventBus.subscribe((payload) => {
            try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch { /* client gone */ }
          })
        : () => {};
      const heartbeat = setInterval(() => {
        try { res.write(": ping\n\n"); } catch { /* client gone */ }
      }, 25_000);
      if (typeof heartbeat.unref === "function") heartbeat.unref();
      const cleanup = () => { clearInterval(heartbeat); unsubscribe(); };
      req.on("close", cleanup);
      req.on("error", cleanup);
      return undefined;
    }

    if (url === "/api/sync/pull" && req.method === "GET") {
      if (!requireAuth(req, res)) return undefined;
      try {
        const result = await resolveSyncProvider().pullSince(requestUrl.searchParams.get("cursor") || 0);
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Sync pull failed" });
      }
    }

    // OCR — proxies multipart image uploads to the PaddleOCR microservice.
    // Requires auth so only logged-in users can submit images for OCR.
    if (url.split("?")[0] === "/api/ocr" && req.method === "POST") {
      if (overLimit(res, "ocr", req)) return undefined;
      if (overLimitUser(res, req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      return handleOcr(req, res);
    }

    // GET /api/v1/search — authenticated full-text search with Arabic normalization
    // (normaliser maps /api/v1/search → /api/search for internal matching)
    if (url.split("?")[0] === "/api/search" && req.method === "GET") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      return handleSearch(req, res, { provider: resolveStorage(), prisma, authSecret: resolvedAuthSecret });
    }

    // ── Admin: backup management (admin/owner only) ──────────────────────────
    // GET  /api/admin/backups     — list all backup files with metadata.
    // POST /api/admin/backups/run — trigger an immediate backup.
    if (req.method === "GET" && url.split("?")[0] === "/api/admin/backups") {
      if (!requireAdmin(req, res)) return undefined;
      return send(res, 200, { ok: true, backups: listBackups() });
    }

    if (req.method === "POST" && url.split("?")[0] === "/api/admin/backups/run") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAdmin(req, res)) return undefined;
      try {
        const result = await runBackup(resolveStorage());
        return send(res, 200, { ok: true, message: "تمت النسخة الاحتياطية بنجاح.", result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Backup failed" });
      }
    }

    // POST /api/admin/backups/preview — read a backup file and return per-store
    // record counts without modifying any live data. For .enc files the
    // passphrase must be supplied in the request body.
    if (req.method === "POST" && url.split("?")[0] === "/api/admin/backups/preview") {
      if (!requireAdmin(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const result = await previewBackup(String(body?.filename || ""), {
          passphrase: typeof body?.passphrase === "string" ? body.passphrase : ""
        });
        return send(res, 200, { ok: true, ...result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Preview failed" });
      }
    }

    // POST /api/admin/backups/restore — restore a stored backup into the live
    // provider. Body: { filename, passphrase?, stores? }. Destructive (replaceAll),
    // so admin-only + checksum verified + decrypt-with-passphrase for .enc files.
    // When `stores` is an array of store keys, only those stores are replaced
    // (partial restore); all other stores are left untouched.
    if (req.method === "POST" && url.split("?")[0] === "/api/admin/backups/restore") {
      if (overLimit(res, "rpc", req)) return undefined;
      const adminUser = requireAdmin(req, res);
      if (!adminUser) return undefined;
      try {
        const body = await readJsonBody(req);
        const storesParam = Array.isArray(body?.stores) ? body.stores.filter(s => typeof s === "string") : null;
        const result = await restoreBackup(resolveStorage(), String(body?.filename || ""), {
          passphrase: typeof body?.passphrase === "string" ? body.passphrase : "",
          stores: storesParam && storesParam.length > 0 ? storesParam : null
        });
        auditLog({
          method: "backup.restore",
          args: [result.filename, ...(storesParam ? [storesParam.join(",")] : [])],
          claims: adminUser,
          ip: clientIp(req)
        });
        return send(res, 200, { ok: true, message: "تمت استعادة النسخة الاحتياطية بنجاح.", result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Restore failed" });
      }
    }

    // POST /api/export — export archive records as csv, xlsx, pdf, citations, or json
    if (req.method === "POST" && url.split("?")[0] === "/api/export") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const allowed = ["csv", "xlsx", "xlsx-template", "pdf", "zip", "bibtex", "ris"];
        const format = allowed.includes(body.format) ? body.format : "csv";
        const store = typeof body.store === "string" && body.store ? body.store : "videoItems";
        const ids = Array.isArray(body.ids) ? body.ids.slice(0, 10000) : null;

        const { exportRecords } = await import("../export/exportService.js");
        const result = await exportRecords(resolveStorage(), { format, store, ids });

        res.writeHead(200, {
          "Content-Type": result.contentType,
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "Content-Length": result.buffer.length,
          "X-API-Version": "1.0",
        });
        res.end(result.buffer);
      } catch (err) {
        if (err.statusCode === 401) {
          return send(res, 401, { ok: false, error: "Unauthorized" });
        }
        logger.error({ err }, "export failed");
        return send(res, 500, { ok: false, error: "export_failed" });
      }
      return undefined;
    }

    // POST /api/ai/suggest-tags — non-blocking tag + category suggestions for a
    // record being created/edited. Body: { name, summary, transcription, categories }.
    // Returns { tags: string[], categoryIds: string[] }.
    if (req.method === "POST" && url.split("?")[0] === "/api/ai/suggest-tags") {
      if (overLimit(res, "ai", req)) return undefined;
      if (overLimitUser(res, req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const provider = aiResolveProvider();
        if (typeof provider?.suggestTags !== "function") {
          return send(res, 503, { ok: false, error: "خدمة اقتراح الوسوم غير مُهيّأة على الخادم." });
        }
        const body = await readJsonBody(req);
        const { name, summary, transcription, categories } = body || {};
        const result = await provider.suggestTags({ name, summary, transcription, categories });
        return send(res, 200, { ok: true, tags: result?.tags ?? [], categoryIds: result?.categoryIds ?? [] });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Tag suggestion failed" });
      }
    }

    // ── Bulk record operations ────────────────────────────────────────────────
    // POST /api/records/bulk — apply an action to multiple records in one request.
    // Body: { action, ids, store?, tags?, type?, project? }
    // Actions: addTags | removeTags | setType | setProject | delete
    if (req.method === "POST" && url.split("?")[0] === "/api/records/bulk") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const ALLOWED_ACTIONS = ["addTags", "removeTags", "setType", "setProject", "delete"];
        if (!ALLOWED_ACTIONS.includes(body.action)) {
          return send(res, 400, { ok: false, error: "invalid_action" });
        }
        if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > 500) {
          return send(res, 400, { ok: false, error: "ids must be array of 1-500" });
        }
        const store = typeof body.store === "string" && body.store ? body.store : "videoItems";
        const provider = resolveStorage();
        const ids = body.ids.map(String);
        let affected = 0;

        if (body.action === "delete") {
          // deleteBatch(store, keys) — keys are the uid strings
          await provider.deleteBatch(store, ids);
          affected = ids.length;
        } else {
          // Fetch all records, apply mutation only to matched ids, then put back
          const allRecords = await provider.getAll(store).catch(() => []);
          const idSet = new Set(ids);
          // getAll returns plain domain objects; key field is "id"
          const toUpdate = Array.isArray(allRecords)
            ? allRecords.filter((r) => r && idSet.has(String(r.id ?? r.uid ?? "")))
            : [];

          const updated = toUpdate.map((record) => {
            const d = { ...record };
            if (body.action === "addTags") {
              const existing = new Set(Array.isArray(d.tags) ? d.tags : []);
              (body.tags ?? []).forEach((t) => existing.add(String(t).trim().toLowerCase()));
              d.tags = [...existing];
            } else if (body.action === "removeTags") {
              const toRemove = new Set((body.tags ?? []).map((t) => String(t).trim().toLowerCase()));
              d.tags = (Array.isArray(d.tags) ? d.tags : []).filter((t) => !toRemove.has(t));
            } else if (body.action === "setType") {
              d.type = String(body.type ?? "");
            } else if (body.action === "setProject") {
              d.project = String(body.project ?? "");
            }
            return d;
          });

          // putBatch(store, items) — items are plain domain objects
          if (updated.length) await provider.putBatch(store, updated);
          affected = updated.length;
        }

        return send(res, 200, { ok: true, affected });
      } catch (error) {
        const statusCode = error?.statusCode || 500;
        if (statusCode >= 500) captureException(error, { endpoint: "records/bulk", reqId: req.id });
        logger.error({ err: error }, "bulk operation failed");
        return send(res, statusCode, { ok: false, error: error?.message || "bulk_failed" });
      }
    }

    // Prometheus scrape endpoint — no auth (protected at network level; bind to
    // localhost in docker-compose so it is never reachable from the public internet).
    if (req.method === "GET" && pathname === "/metrics") {
      const output = await getMetricsOutput();
      res.writeHead(200, { "Content-Type": getContentType() });
      res.end(output);
      return;
    }

    // ── Record version history ──────────────────────────────────────────────
    // GET  /api/records/:uid/versions?store=videoItems
    //   Returns the saved snapshots list (without snapshot body) so the
    //   DetailPage "السجل التاريخي" tab can render the version timeline.
    if (req.method === "GET" && /^\/api\/records\/[^/]+\/versions$/.test(url.split("?")[0])) {
      if (!requireAuth(req, res)) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "السجل التاريخي غير متاح في هذا الإعداد." });
      try {
        const uid = url.split("?")[0].split("/")[3];
        const store = requestUrl.searchParams.get("store") ?? "videoItems";
        const versions = await prisma.recordVersion.findMany({
          where: { store, recordUid: uid },
          orderBy: { version: "desc" },
          take: 50,
          select: { id: true, version: true, userId: true, createdAt: true },
        });
        return send(res, 200, { ok: true, versions });
      } catch (err) {
        logger.error({ err }, "versions list failed");
        return send(res, 500, { ok: false, error: "versions_failed" });
      }
    }

    // POST /api/records/:uid/restore/:version?store=videoItems
    //   Fetches the stored snapshot and calls resolveStorage().put() to
    //   overwrite the current record. Requires editor privileges.
    if (req.method === "POST" && /^\/api\/records\/[^/]+\/restore\/\d+$/.test(url.split("?")[0])) {
      if (!requireEditor(req, res)) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "الاستعادة غير متاحة في هذا الإعداد." });
      try {
        const parts = url.split("?")[0].split("/");
        const uid = parts[3];
        const version = parseInt(parts[5], 10);
        const store = requestUrl.searchParams.get("store") ?? "videoItems";
        const versionRow = await prisma.recordVersion.findFirst({
          where: { store, recordUid: uid, version },
        });
        if (!versionRow) {
          return send(res, 404, { ok: false, error: "version_not_found" });
        }
        await resolveStorage().put(store, versionRow.snapshot);
        return send(res, 200, { ok: true, restoredVersion: version });
      } catch (err) {
        logger.error({ err }, "version restore failed");
        return send(res, 500, { ok: false, error: "restore_failed" });
      }
    }

    // ── Saved Filters / Smart Collections (Task 69) ──────────────────────────
    // GET  /api/saved-filters         — list caller's saved filters
    // POST /api/saved-filters         — create a new saved filter
    // DELETE /api/saved-filters/:id   — delete a saved filter owned by caller

    if (url === "/api/saved-filters" && req.method === "GET") {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "المجموعات الذكية غير متاحة في هذا الإعداد." });
      try {
        const filters = await prisma.savedFilter.findMany({
          where: { ownerId: claims.sub },
          orderBy: { updatedAt: "desc" },
        });
        return send(res, 200, { ok: true, filters });
      } catch (err) {
        logger.error({ err }, "saved-filters list failed");
        return send(res, 500, { ok: false, error: "saved_filters_failed" });
      }
    }

    if (url === "/api/saved-filters" && req.method === "POST") {
      if (overLimit(res, "rpc", req)) return undefined;
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "المجموعات الذكية غير متاحة في هذا الإعداد." });
      try {
        const body = await readJsonBody(req);
        if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
          return send(res, 400, { ok: false, error: "الاسم مطلوب." });
        }
        const filter = await prisma.savedFilter.create({
          data: {
            id: randomUUID(),
            name: String(body.name).trim().slice(0, 100),
            query: body.query ?? {},
            isLive: Boolean(body.isLive),
            ownerId: claims.sub,
          },
        });
        return send(res, 201, { ok: true, filter });
      } catch (err) {
        logger.error({ err }, "saved-filters create failed");
        return send(res, 500, { ok: false, error: "saved_filters_create_failed" });
      }
    }

    if (req.method === "DELETE" && /^\/api\/saved-filters\/[^/]+$/.test(url.split("?")[0])) {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "المجموعات الذكية غير متاحة في هذا الإعداد." });
      try {
        const id = url.split("?")[0].split("/").pop();
        await prisma.savedFilter.deleteMany({ where: { id, ownerId: claims.sub } });
        return send(res, 200, { ok: true });
      } catch (err) {
        logger.error({ err }, "saved-filters delete failed");
        return send(res, 500, { ok: false, error: "saved_filters_delete_failed" });
      }
    }

    // ── Webhooks CRUD (Task 70) ────────────────────────────────────────────────
    // GET  /api/webhooks        — list caller's webhooks
    // POST /api/webhooks        — register a new webhook
    // DELETE /api/webhooks/:id  — delete a webhook owned by caller

    if (url === "/api/webhooks" && req.method === "GET") {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "Webhooks غير متاح في هذا الإعداد." });
      try {
        const hooks = await prisma.webhook.findMany({
          where: { ownerId: claims.sub },
          orderBy: { createdAt: "desc" },
        });
        return send(res, 200, { ok: true, hooks });
      } catch (err) {
        logger.error({ err }, "webhooks list failed");
        return send(res, 500, { ok: false, error: "webhooks_list_failed" });
      }
    }

    if (url === "/api/webhooks" && req.method === "POST") {
      if (overLimit(res, "rpc", req)) return undefined;
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "Webhooks غير متاح في هذا الإعداد." });
      try {
        const body = await readJsonBody(req);
        if (!body.url || typeof body.url !== "string") {
          return send(res, 400, { ok: false, error: "url required" });
        }
        try { new URL(body.url); } catch {
          return send(res, 400, { ok: false, error: "invalid url" });
        }
        const ALLOWED_EVENTS = ["record.created", "record.updated", "record.deleted", "record.restored"];
        const events = Array.isArray(body.events)
          ? body.events.filter(e => ALLOWED_EVENTS.includes(e))
          : ALLOWED_EVENTS;
        const secret = body.secret || randomUUID().replace(/-/g, "");
        const hook = await prisma.webhook.create({
          data: {
            url: String(body.url).slice(0, 500),
            events,
            secret,
            active: true,
            ownerId: claims.sub,
          },
        });
        return send(res, 201, { ok: true, hook });
      } catch (err) {
        logger.error({ err }, "webhooks create failed");
        return send(res, 500, { ok: false, error: "webhooks_create_failed" });
      }
    }

    if (req.method === "DELETE" && /^\/api\/webhooks\/[^/]+$/.test(url.split("?")[0])) {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "Webhooks غير متاح في هذا الإعداد." });
      try {
        const id = url.split("?")[0].split("/").pop();
        await prisma.webhook.deleteMany({ where: { id, ownerId: claims.sub } });
        return send(res, 200, { ok: true });
      } catch (err) {
        logger.error({ err }, "webhooks delete failed");
        return send(res, 500, { ok: false, error: "webhooks_delete_failed" });
      }
    }

    // ── Notification preferences ─────────────────────────────────────────────
    // GET  /api/notification-preferences  — fetch the current user's prefs
    // PATCH /api/notification-preferences — update one or more boolean prefs

    if (url.split("?")[0] === "/api/notification-preferences" && req.method === "GET") {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) {
        // No Postgres — return safe defaults so the UI still works.
        return send(res, 200, { ok: true, prefs: { emailOnShare: true, emailOnUpload: false, emailOnMention: true } });
      }
      try {
        const prefs = await prisma.notificationPreference.findUnique({ where: { userId: claims.sub } })
          ?? { emailOnShare: true, emailOnUpload: false, emailOnMention: true };
        return send(res, 200, { ok: true, prefs });
      } catch (err) {
        logger.warn({ err }, "notification-preferences GET failed");
        return send(res, 500, { ok: false, error: "failed" });
      }
    }

    if (url.split("?")[0] === "/api/notification-preferences" && req.method === "PATCH") {
      if (overLimit(res, "rpc", req)) return undefined;
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) {
        return send(res, 501, { ok: false, error: "Notification preferences غير متاحة في هذا الإعداد." });
      }
      try {
        const body = await readJsonBody(req);
        const data = {};
        if (typeof body.emailOnShare === "boolean") data.emailOnShare = body.emailOnShare;
        if (typeof body.emailOnUpload === "boolean") data.emailOnUpload = body.emailOnUpload;
        if (typeof body.emailOnMention === "boolean") data.emailOnMention = body.emailOnMention;
        if (typeof body.pushOnShare === "boolean") data.pushOnShare = body.pushOnShare;
        if (typeof body.pushOnUpload === "boolean") data.pushOnUpload = body.pushOnUpload;
        if (typeof body.pushOnMention === "boolean") data.pushOnMention = body.pushOnMention;
        if (typeof body.pushOnSystem === "boolean") data.pushOnSystem = body.pushOnSystem;
        if (Object.keys(data).length === 0) {
          return send(res, 400, { ok: false, error: "No valid preference fields provided." });
        }
        const prefs = await prisma.notificationPreference.upsert({
          where: { userId: claims.sub },
          create: { id: randomUUID(), userId: claims.sub, ...data },
          update: data,
        });
        return send(res, 200, { ok: true, prefs });
      } catch (err) {
        logger.warn({ err }, "notification-preferences PATCH failed");
        return send(res, 500, { ok: false, error: "failed" });
      }
    }

    // ── API keys (§20.5) ─────────────────────────────────────────────────────
    // Management (JWT-authenticated owner):
    //   GET    /api/api-keys        — list the caller's keys (no secrets)
    //   POST   /api/api-keys        — create a key (plaintext returned ONCE)
    //   DELETE /api/api-keys/:id    — revoke a key
    // Public programmatic read (X-API-Key header):
    //   GET    /api/public/records?store=video_items — scoped read access

    if (url.split("?")[0] === "/api/api-keys" && req.method === "GET") {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "مفاتيح API غير متاحة في هذا الإعداد." });
      try {
        return send(res, 200, { ok: true, keys: await listApiKeys(prisma, claims.sub) });
      } catch (err) {
        logger.warn({ err: err?.message }, "api-keys list failed");
        return send(res, 500, { ok: false, error: "failed" });
      }
    }

    if (url.split("?")[0] === "/api/api-keys" && req.method === "POST") {
      if (overLimit(res, "rpc", req)) return undefined;
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "مفاتيح API غير متاحة في هذا الإعداد." });
      try {
        const body = await readJsonBody(req);
        // Privilege gate: a key can never grant more than its creator holds.
        // Only editor/admin/owner may mint a write-scoped key.
        const wantsWrite = Array.isArray(body?.scopes) && body.scopes.includes("write");
        if (wantsWrite && !["editor", "admin", "owner"].includes(claims.role)) {
          return send(res, 403, { ok: false, error: "نطاق الكتابة يتطلّب صلاحية محرّر أو أعلى." });
        }
        const created = await createApiKey(prisma, {
          name: body?.name, scopes: body?.scopes, ownerId: claims.sub, expiresAt: body?.expiresAt,
        });
        authLog.info({ event: "api_key_create", sub: claims.sub, prefix: created.prefix, ip: clientIp(req) }, "AUDIT: API key created");
        return send(res, 201, { ok: true, apiKey: created });
      } catch (err) {
        return send(res, err?.statusCode || 500, { ok: false, error: err?.message || "failed" });
      }
    }

    if (url.split("?")[0].startsWith("/api/api-keys/") && req.method === "DELETE") {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "مفاتيح API غير متاحة في هذا الإعداد." });
      const id = decodeURIComponent(url.split("?")[0].slice("/api/api-keys/".length));
      try {
        const removed = await revokeApiKey(prisma, claims.sub, id);
        if (!removed) return send(res, 404, { ok: false, error: "المفتاح غير موجود." });
        authLog.info({ event: "api_key_revoke", sub: claims.sub, id, ip: clientIp(req) }, "AUDIT: API key revoked");
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 500, { ok: false, error: "failed" });
      }
    }

    if (url.split("?")[0] === "/api/public/records" && req.method === "GET") {
      if (overLimit(res, "rpc", req)) return undefined;
      const presented = req.headers["x-api-key"] || req.headers["X-API-Key"];
      const principal = await verifyApiKey(prisma, Array.isArray(presented) ? presented[0] : presented);
      if (!principal) return send(res, 401, { ok: false, error: "مفتاح API غير صالح أو منتهٍ." });
      if (!principal.scopes.includes("read")) return send(res, 403, { ok: false, error: "نطاق القراءة غير ممنوح." });
      // Per-key throttle — independent of the IP-based cap above.
      if (limiters && !limiters.apiKey.check(principal.apiKeyId)) {
        return send(res, 429, { ok: false, error: "تجاوزت حدّ الطلبات لهذا المفتاح." });
      }
      try {
        const params = requestUrl.searchParams;
        const store = String(params.get("store") || "video_items");
        // Hard gate: never let an API key read auth/config/secret stores.
        if (!PUBLIC_READABLE_STORES.has(store)) {
          return send(res, 403, { ok: false, error: "هذا المخزن غير متاح للقراءة العامة." });
        }
        const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 200);
        const cursor = params.get("cursor") || "";
        const all = await resolveStorage().getAll(store).catch(() => []);
        // Stable keyset pagination: sort by id, return the page strictly after
        // `cursor`. nextCursor is the last id of the page when more remain.
        const sorted = [...all].sort((a, b) =>
          String(a?.id ?? a?.uid ?? "").localeCompare(String(b?.id ?? b?.uid ?? ""))
        );
        const startIdx = cursor
          ? sorted.findIndex((r) => String(r?.id ?? r?.uid ?? "") > cursor)
          : 0;
        const begin = startIdx === -1 ? sorted.length : startIdx;
        const page = sorted.slice(begin, begin + limit);
        const hasMore = begin + limit < sorted.length;
        const nextCursor = hasMore && page.length
          ? String(page[page.length - 1]?.id ?? page[page.length - 1]?.uid ?? "")
          : null;
        return send(res, 200, { ok: true, store, count: all.length, records: page, nextCursor });
      } catch (err) {
        return send(res, 500, { ok: false, error: "failed" });
      }
    }

    // ── Workflow (§20.3) ─────────────────────────────────────────────────────
    // GET  /api/workflow/definition — states/labels/transitions for UI menus
    // POST /api/workflow/transition — move a record to a new state (role-gated)

    if (url.split("?")[0] === "/api/workflow/definition" && req.method === "GET") {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      return send(res, 200, { ok: true, definition: getWorkflowDefinition() });
    }

    if (url.split("?")[0] === "/api/workflow/transition" && req.method === "POST") {
      if (overLimit(res, "rpc", req)) return undefined;
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      try {
        const body = await readJsonBody(req);
        const store = String(body?.store || "video_items");
        const id = String(body?.id || "");
        if (!id) return send(res, 400, { ok: false, error: "معرّف السجل مطلوب." });

        const storage = resolveStorage();
        const existing = typeof storage.get === "function"
          ? await storage.get(store, id)
          : (await storage.getAll(store).catch(() => [])).find((r) => String(r?.id) === id);
        if (!existing) return send(res, 404, { ok: false, error: "السجل غير موجود." });

        const { record, entry } = applyTransition(existing, {
          to: body?.to,
          role: claims.role || "viewer",
          userId: claims.sub,
          username: claims.username,
          dueDate: body?.dueDate,
          note: body?.note,
        });
        await storage.put(store, record);

        authLog.info(
          { event: "workflow_transition", store, id, from: entry.from, to: entry.to, sub: claims.sub },
          "AUDIT: workflow transition"
        );
        // Outgoing webhook + push to the record owner (when someone else acted).
        fireWebhooks(prisma, "record.status_changed", { store, uid: id, from: entry.from, to: entry.to }, record?.ownerId, logger);
        if (record?.ownerId && record.ownerId !== claims.sub) {
          sendPushToUser({
            prisma,
            userId: record.ownerId,
            type: "system",
            title: `تغيّرت حالة السجل — ${record?.title || id}`,
            body: `من «${entry.from}» إلى «${entry.to}» بواسطة ${claims.username || "مستخدم"}`,
            tag: `workflow:${id}`,
          });
        }
        return send(res, 200, { ok: true, result: { id, status: record.workflowStatus, dueDate: record.workflowDueDate, entry } });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "فشل تغيير الحالة." });
      }
    }

    // ── Web Push (§20.2) ─────────────────────────────────────────────────────
    // GET  /api/push/vapid-public-key — VAPID key for PushManager.subscribe
    // POST /api/push/subscribe        — store this browser's subscription
    // POST /api/push/unsubscribe      — drop it again

    if (url.split("?")[0] === "/api/push/vapid-public-key" && req.method === "GET") {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!isPushConfigured()) {
        return send(res, 501, { ok: false, error: "Web Push غير مهيأ على هذا الخادم (VAPID keys)." });
      }
      return send(res, 200, { ok: true, key: getVapidPublicKey() });
    }

    if (url.split("?")[0] === "/api/push/subscribe" && req.method === "POST") {
      if (overLimit(res, "rpc", req)) return undefined;
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "Web Push غير متاح في هذا الإعداد." });
      try {
        const body = await readJsonBody(req);
        await savePushSubscription(prisma, claims.sub, body?.subscription || body);
        return send(res, 200, { ok: true });
      } catch (err) {
        logger.warn({ err: err?.message }, "push subscribe failed");
        return send(res, err?.statusCode || 500, { ok: false, error: err?.message || "failed" });
      }
    }

    if (url.split("?")[0] === "/api/push/unsubscribe" && req.method === "POST") {
      if (overLimit(res, "rpc", req)) return undefined;
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      if (!prisma) return send(res, 501, { ok: false, error: "Web Push غير متاح في هذا الإعداد." });
      try {
        const body = await readJsonBody(req);
        await removePushSubscription(prisma, claims.sub, body?.endpoint);
        return send(res, 200, { ok: true });
      } catch (err) {
        logger.warn({ err: err?.message }, "push unsubscribe failed");
        return send(res, err?.statusCode || 500, { ok: false, error: err?.message || "failed" });
      }
    }

    // POST /api/export — export records as CSV, XLSX, PDF, citations, or ZIP
    if (req.method === "POST" && url === "/api/export") {
      const claims = requireAuthClaims(req, res);
      if (!claims) return undefined;
      const { format = "csv", store = "videoItems", ids = null } = body || {};
      const allowed = ["csv", "xlsx", "xlsx-template", "pdf", "zip", "bibtex", "ris"];
      if (!allowed.includes(format)) {
        return send(res, 400, { ok: false, error: `Unsupported format: ${format}. Use csv, xlsx, xlsx-template, pdf, zip, bibtex, or ris.` });
      }
      const result = await exportRecords(resolveStorage(), { format, store, ids }).catch((err) => {
        log.error({ err }, "Export failed");
        return null;
      });
      if (!result) return send(res, 500, { ok: false, error: "Export failed." });
      res.writeHead(200, {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.buffer.length),
      });
      res.end(result.buffer);
      return undefined;
    }

    // ── Rights & License management (§22) ────────────────────────────────────
    if (await handleRightsRoute({
      req,
      res,
      url,
      params: requestUrl.searchParams,
      sendJson: send,
      requireAuth,
      requireEditor,
      overLimit,
      readJsonBody,
      prisma,
    })) {
      return undefined;
    }

    // ── Per-item metadata export (§22.x) ─────────────────────────────────────
    // GET /api/items/:id/export/pbcore.xml     → application/xml
    // GET /api/items/:id/export/dublincore.rdf → application/rdf+xml
    if (await handleExportRoute({ url, req, res, requireAuth, resolveStorage, send })) {
      return undefined;
    }

    return send(res, 404, { ok: false, error: "Not found" });
  });
}

/** Convenience: build + listen. Returns the server so callers can close it. */
export function startApiServer({ port = 8787, host = "0.0.0.0", ...options } = {}) {
  const server = createApiServer(options);
  server.listen(port, host, () => {
    logger.info({ port, host, backend: options.backend || "unknown" }, "archive-api listening");
  });
  return server;
}
