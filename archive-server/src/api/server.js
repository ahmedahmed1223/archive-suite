import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { config } from "../config/env.js";

import { getFileStore, getSyncProvider, getAiProvider, getStorageProvider } from "@archive/core";

import { logger, createLogger } from "../logger.js";
import { auditLog } from "./auditLogger.js";
import { dispatchRpc } from "./rpcHandler.js";
import { dispatchAi } from "./aiHandler.js";
import { checkFfmpegAvailability, exportTimelineToMp4 } from "../export/mp4.js";
import { createInMemoryMediaJobStore } from "../media/mediaJobs.js";
import { createConversionService } from "../conversion/conversionService.js";
import { createConversionJobRunner } from "../conversion/conversionJobRunner.js";
import { createSharePermissionService } from "../share/sharePermissionService.js";
import { createShareInvitationService } from "../share/invitationService.js";
import { runMediaDerivative, runMediaProbe } from "../media/runMedia.js";
import { verifyJwt } from "../auth/jwt.js";
import { resolveServerConfig, loadServerConfigFile, saveServerConfigFile } from "../config/serverConfig.js";
import { buildFileStore } from "../bootstrap/registerCloudProviders.js";
import { testDatabaseConnection, testFileStoreConnection } from "./adminConfig.js";
import { createRateLimiter, clientIp, userKeyFromHeader } from "./rateLimit.js";
import { captureException } from "../monitoring/sentryService.js";
import { getPresetConfig } from "./presetConfig.js";
import {
  getMetricsOutput, getContentType,
  incActiveRequests, decActiveRequests, recordRequest
} from "../monitoring/metrics.js";
import { handleControlRoute } from "./controlRoutes.js";
import { handleRightsRoute } from "./routes/rights.js";
import { publicOpenApiSpec } from "./publicOpenApi.js";
import { handleExportRoute } from "./routes/export.js";
import { createControlAgent } from "../control/controlAgent.js";
import { importPreviewService } from "../import/importPreview.js";
import { sendMail as defaultSendMail } from "../auth/emailService.js";

// Route modules — each handler returns true if it handled the request.
import {
  handleAuthRoute,
  handleMediaRoute,
  handleShareRoute,
  handleBackupRoute,
  handleAdminRoute,
  handleUserDataRoute,
} from "../routes/index.js";

// Minimal dependency-free HTTP server exposing the StorageProvider port to the
// SPA over a single RPC endpoint. Node's built-in http keeps the runtime image
// tiny and the attack surface small (no Express middleware chain).
//
// Routes delegated to route modules:
//   /api/auth/*          → routes/authRoutes.js
//   /api/media/*, /api/files/*, /api/upload-sessions/*, /api/projects/export
//                        → routes/mediaRoutes.js
//   /api/share*, /api/share-access*
//                        → routes/shareRoutes.js
//   /api/admin/backups*  → routes/backupRoutes.js
//   admin/config, search, OCR, AI, API-keys, webhooks, workflow, push, etc.
//                        → routes/adminRoutes.js
//
// Auth: when `authSecret` is provided, /api/rpc requires a valid
// `Authorization: Bearer <jwt>`. /api/health and /api/auth/login stay open.

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
  mediaRootDir = config.fileStoreDir,
  ffmpegPath = config.ffmpegPath,
  runExport = exportTimelineToMp4,
  checkFfmpeg = checkFfmpegAvailability,
  extraHealth = null,
  mediaJobStore = createInMemoryMediaJobStore(),
  mediaWorker = null,
  runMediaProbeImpl = runMediaProbe,
  runMediaDerivativeImpl = runMediaDerivative,
  resolveStorage = getStorageProvider,
  shareSecret = authSecret,
  shareExpiryDays = config.shareExpiryDays,
  prisma = null,
  resolveConfig = resolveServerConfig,
  loadConfigFile = loadServerConfigFile,
  saveConfig = saveServerConfigFile,
  testDbConnection = testDatabaseConnection,
  buildFileStoreCandidate = buildFileStore,
  testFileStore = testFileStoreConnection,
  notificationSendMail = defaultSendMail,
  version = config.appVersion,
  dropboxOAuthFetch,
  controlAgent = createControlAgent(),
  importPreview = importPreviewService
} = {}) {
  const resolvedAuthSecret  = config.jwtAuthSecret  || authSecret;
  const resolvedShareSecret = config.jwtShareSecret || shareSecret;
  const resolvedOauthSecret = config.oauthStateSecret || resolvedAuthSecret || resolvedShareSecret;

  const authRequired = Boolean(resolvedAuthSecret);
  const oauthSecret = resolvedOauthSecret;
  const refreshExpiresInSec = config.refreshExpiresInSec;
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

  // §16.15 — conversion service
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

  // §16.7 — share permission enforcement
  const sharePermissionSvc = createSharePermissionService({ resolvedShareSecret });
  const shareInvitationSvc = createShareInvitationService({
    resolvedShareSecret,
    defaultExpiryDays: shareExpiryDays,
    sendMail: notificationSendMail,
    resolveStorage,
    db: prisma
  });

  // §20.5 — public API key store allowlist
  const PUBLIC_READABLE_STORES = new Set(
    config.publicApiStores.split(",").map((s) => s.trim()).filter(Boolean)
  );

  // Rate limiters (disabled when rateLimit === null, e.g. some tests)
  const limiters = rateLimit === null ? null : {
    rpc:         createRateLimiter({ max: rateLimit.rpcMax  ?? 100, windowMs: rateLimit.windowMs ?? 60_000 }),
    user:        createRateLimiter({ max: rateLimit.userMax ?? 60,  windowMs: rateLimit.windowMs ?? 60_000 }),
    ai:          createRateLimiter({ max: rateLimit.aiMax   ?? 30,  windowMs: rateLimit.windowMs ?? 60_000 }),
    ocr:         createRateLimiter({ max: rateLimit.ocrMax  ?? 10,  windowMs: rateLimit.windowMs ?? 60_000 }),
    login:       createRateLimiter({ max: rateLimit.loginMax ?? 10, windowMs: rateLimit.windowMs ?? 60_000 }),
    reset:       createRateLimiter({ max: rateLimit.resetMax ?? 5,  windowMs: rateLimit.windowMs ?? 60_000 }),
    totpDisable: createRateLimiter({ max: 3, windowMs: 15 * 60_000 }),
    apiKey:      createRateLimiter({ max: rateLimit.apiKeyMax ?? 120, windowMs: rateLimit.windowMs ?? 60_000 }),
  };

  function overLimit(res, bucket, req) {
    if (!limiters) return false;
    if (limiters[bucket].check(clientIp(req))) return false;
    send(res, 429, { ok: false, error: "Too many requests — slow down." });
    return true;
  }

  function overLimitUser(res, req) {
    if (!limiters) return false;
    const key = userKeyFromHeader(req);
    if (!key) return false;
    if (limiters.user.check(key)) return false;
    send(res, 429, { ok: false, error: "Too many requests — slow down." });
    return true;
  }

  function requireAuth(req, res) {
    if (!authRequired) return true;
    const token = bearerToken(req);
    try {
      if (!token) { const err = new Error("Authentication required."); err.statusCode = 401; throw err; }
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
      if (!token) { const err = new Error("Authentication required."); err.statusCode = 401; throw err; }
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
        concurrency: config.mediaJobConcurrency,
        runMediaDerivativeImpl,
        runExport,
        mediaRootDir
      });
    }
    return defaultMediaWorker;
  }

  // Shared context object passed to all route handlers
  const routeCtx = () => ({
    send, overLimit, overLimitUser, readJsonBody, readRawBody,
    requireAuth, requireEditor, requireAdmin, requireAuthClaims,
    resolveStorage, resolvedAuthSecret, resolvedShareSecret,
    refreshExpiresInSec, login, authRequired, bearerToken, clientIp,
    shareExpiryDays, sharePermissionSvc, shareInvitationSvc,
    prisma, notificationSendMail,
    resolveFileStore, runMediaProbeImpl, runMediaDerivativeImpl,
    runExport, mediaRootDir, ffmpegPath, mediaJobStore, conversionSvc, getMediaWorker,
    resolveConfig, loadConfigFile, saveConfig,
    testDbConnection, buildFileStoreCandidate, testFileStore,
    oauthSecret, dropboxOAuthFetch, aiResolveProvider,
    limiters, PUBLIC_READABLE_STORES,
  });

  return createServer(async (req, res) => {
    req.id = req.headers["x-request-id"] || randomUUID();
    res.setHeader("X-Request-Id", req.id);
    const reqLog = logger.child({ reqId: req.id, method: req.method, url: req.url });
    reqLog.debug({ ip: clientIp(req) }, "incoming request");

    // Prometheus active-request tracking
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

    // Dev CORS
    if (corsOrigin) {
      res.setHeader("Access-Control-Allow-Origin", corsOrigin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    }

    const requestUrl = new URL(req.url || "/", "http://localhost");
    const pathname = requestUrl.pathname;

    // /api/v1/* → normalise to /api/* for internal matching; legacy paths get Sunset header
    let url;
    let isLegacyPath = false;
    if (pathname.startsWith("/api/v1/")) {
      url = "/api/" + pathname.slice("/api/v1/".length);
    } else {
      url = pathname;
      if (pathname.startsWith("/api/") && pathname !== "/api/") isLegacyPath = true;
    }

    if (pathname.startsWith("/api/")) res.setHeader("X-API-Version", "1.0");
    if (isLegacyPath) {
      res.setHeader("Sunset", "Sat, 01 Jan 2028 00:00:00 GMT");
      res.setHeader("Link", `</api/v1${pathname.slice("/api".length)}>; rel="successor-version"`);
    }

    // ── API discovery ─────────────────────────────────────────────────────────
    if ((pathname === "/api/" || pathname === "/api/v1/") && req.method === "GET") {
      return send(res, 200, {
        version: "1.0",
        endpoints: {
          health: "/api/v1/health", publicOpenApi: "/api/v1/public/openapi.json",
          publicRecords: "/api/v1/public/records", rpc: "/api/v1/rpc", search: "/api/v1/search",
          auth: { login: "/api/v1/auth/login", logout: "/api/v1/auth/logout",
                  requestReset: "/api/v1/auth/request-reset", totp: "/api/v1/auth/totp/setup" },
          share: "/api/v1/share", ocr: "/api/v1/ocr",
        },
      });
    }

    if (req.method === "GET" && url === "/api/public/openapi.json") {
      return send(res, 200, publicOpenApiSpec);
    }

    // ── /api/control/* ────────────────────────────────────────────────────────
    if (await handleControlRoute({ req, res, url, requestUrl, authorizeAdmin: requireAdmin,
        sendJson: send, agent: resolvedControlAgent, overLimit, readJsonBody })) {
      return undefined;
    }

    // ── /api/import/preview ───────────────────────────────────────────────────
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

    // ── /api/health ───────────────────────────────────────────────────────────
    if (req.method === "GET" && (url === "/api/health" || url === "/health")) {
      const cfg = resolveConfig();
      let db;
      let extras = {};
      try { db = await buildDatabaseHealth(resolveStorage()); }
      catch (error) { db = { ok: false, latencyMs: 0, error: safeDbError(error) }; }
      if (typeof extraHealth === "function") {
        try { extras = await extraHealth(); }
        catch (error) { extras = { healthExtrasError: error?.message || "extra health failed" }; }
      }
      return send(res, 200, {
        ok: true, backend,
        engine: backend === "pocketbase" ? "pocketbase" : cfg.databaseEngine || "postgresql",
        db, export: { mp4: { serverFfmpeg: await getFfmpegHealth(), wasmFallback: "client_optional" } },
        uptimeSec: Math.floor(process.uptime()), version, authRequired, ...extras
      });
    }

    // ── /api/setup/* ──────────────────────────────────────────────────────────
    if (req.method === "GET" && url === "/api/setup/status") {
      try {
        const users = await resolveStorage().getAll("users").catch(() => []);
        return send(res, 200, { needsSetup: users.length === 0 });
      } catch { return send(res, 200, { needsSetup: false }); }
    }

    if (req.method === "GET" && url === "/api/setup/preset-config") {
      try {
        const users = await resolveStorage().getAll("users").catch(() => []);
        if (users.length > 0) return send(res, 403, { ok: false, error: "Setup already complete." });
        const cfg = await getPresetConfig();
        return send(res, 200, { ok: true, config: cfg });
      } catch (err) {
        return send(res, 500, { ok: false, error: err?.message || "Failed to read preset config." });
      }
    }

    // ── Auth routes (/api/auth/*) ─────────────────────────────────────────────
    if (url.startsWith("/api/auth")) {
      if (await handleAuthRoute({ req, res, url, ...routeCtx() })) return undefined;
    }

    // ── /api/rpc ──────────────────────────────────────────────────────────────
    if (req.method === "POST" && url === "/api/rpc") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
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

    // ── /api/ai/* ─────────────────────────────────────────────────────────────
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

    // ── /api/sync/* ───────────────────────────────────────────────────────────
    if (url === "/api/sync/push" && req.method === "POST") {
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const result = await resolveSyncProvider().pushChange(body);
        if (eventBus) eventBus.publish({ type: "change", change: body });
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Sync push failed" });
      }
    }

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
        "X-Accel-Buffering": "no"
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

    // ── /api/export ───────────────────────────────────────────────────────────
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
        if (err.statusCode === 401) return send(res, 401, { ok: false, error: "Unauthorized" });
        logger.error({ err }, "export failed");
        return send(res, 500, { ok: false, error: "export_failed" });
      }
      return undefined;
    }

    // ── Prometheus /metrics ───────────────────────────────────────────────────
    if (req.method === "GET" && pathname === "/metrics") {
      const output = await getMetricsOutput();
      res.writeHead(200, { "Content-Type": getContentType() });
      res.end(output);
      return;
    }

    // ── Media & file routes ───────────────────────────────────────────────────
    if (await handleMediaRoute({ req, res, url, requestUrl, reqLog, ...routeCtx() })) {
      return undefined;
    }

    // ── Share routes ──────────────────────────────────────────────────────────
    if (await handleShareRoute({ req, res, url, requestUrl, ...routeCtx() })) {
      return undefined;
    }

    // ── Backup routes ─────────────────────────────────────────────────────────
    if (await handleBackupRoute({ req, res, url, ...routeCtx() })) {
      return undefined;
    }

    // ── Admin / misc routes ───────────────────────────────────────────────────
    if (await handleAdminRoute({ req, res, url, requestUrl, ...routeCtx() })) {
      return undefined;
    }

    // ── User data routes (saved-filters, webhooks, workflow, push, etc.) ──────
    if (await handleUserDataRoute({ req, res, url, requestUrl, ...routeCtx() })) {
      return undefined;
    }

    // ── Rights & license management ───────────────────────────────────────────
    if (await handleRightsRoute({ req, res, url, params: requestUrl.searchParams,
        sendJson: send, requireAuth, requireEditor, overLimit, readJsonBody, prisma })) {
      return undefined;
    }

    // ── Per-item metadata export ──────────────────────────────────────────────
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
