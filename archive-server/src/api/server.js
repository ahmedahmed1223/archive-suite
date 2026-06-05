import { createServer } from "node:http";

import { getFileStore, getSyncProvider, getAiProvider, getStorageProvider } from "@archive/core";

import { dispatchRpc } from "./rpcHandler.js";
import { dispatchAi } from "./aiHandler.js";
import { exportTimelineToMp4 } from "../export/mp4.js";
import { createInMemoryMediaJobStore, createMediaJobWorker, montageOutputKey, storeMontageOutput } from "../media/mediaJobs.js";
import { runMediaDerivative, runMediaProbe } from "../media/runMedia.js";
import { verifyJwt } from "../auth/jwt.js";
import { mintShareToken, readShareTokenPayload } from "../share/token.js";
import { filterSnapshotForShare } from "../share/scope.js";
import {
  buildDropboxOAuthUrl,
  createDropboxOAuthState,
  exchangeDropboxOAuthCode,
  readDropboxOAuthState
} from "../dropbox/oauth.js";
import { resolveServerConfig, loadServerConfigFile, saveServerConfigFile } from "../config/serverConfig.js";
import {
  buildConfigView, validateDbConfig, mergeDbConfig, validateFileStoreConfig,
  mergeFileStoreConfig, testDatabaseConnection
} from "./adminConfig.js";
import { createRateLimiter, clientIp } from "./rateLimit.js";

// Minimal dependency-free HTTP server exposing the StorageProvider port to the
// SPA over a single RPC endpoint. Node's built-in http keeps the runtime image
// tiny and the attack surface small (no Express middleware chain).
//
// Routes:
//   GET  /api/health      → { ok, backend, authRequired }
//   POST /api/auth/login  → { ok, token, user }   body: { username, password }
//   POST /api/rpc         → { ok, result } | { ok:false, error }
//                           body: { method, args }   (Bearer JWT required when authSecret set)
//
// Auth: when `authSecret` is provided, /api/rpc requires a valid
// `Authorization: Bearer <jwt>`. /api/health and /api/auth/login stay open.
// When no secret is set the API is UNAUTHENTICATED — a loud warning is logged
// at startup (see src/index.js). The SPA's cloud-http adapter forwards each of
// its 11 methods to /api/rpc, so the contract never drifts from the port.

const MAX_BODY_BYTES = 256 * 1024 * 1024; // 256MB — matches nginx/Caddy limits.

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
  runExport = exportTimelineToMp4,
  mediaJobStore = createInMemoryMediaJobStore(),
  mediaWorker = null,
  runMediaProbeImpl = runMediaProbe,
  runMediaDerivativeImpl = runMediaDerivative,
  resolveStorage = getStorageProvider,
  shareSecret = authSecret,
  shareExpiryDays = Number(process.env.SHARE_EXPIRY_DAYS) || 30,
  resolveConfig = resolveServerConfig,
  loadConfigFile = loadServerConfigFile,
  saveConfig = saveServerConfigFile,
  testDbConnection = testDatabaseConnection,
  version = process.env.npm_package_version || process.env.APP_VERSION || "0.0.0",
  dropboxOAuthFetch
} = {}) {
  const authRequired = Boolean(authSecret);
  const oauthSecret = authSecret || shareSecret;

  // Two buckets: a generous one for RPC, a strict one for login (brute-force
  // defense). Disabled entirely when rateLimit is null (e.g. some tests).
  const limiters = rateLimit === null ? null : {
    rpc: createRateLimiter({ max: rateLimit.rpcMax ?? 600, windowMs: rateLimit.windowMs ?? 60_000 }),
    login: createRateLimiter({ max: rateLimit.loginMax ?? 10, windowMs: rateLimit.windowMs ?? 60_000 })
  };

  function overLimit(res, bucket, req) {
    if (!limiters) return false;
    if (limiters[bucket].check(clientIp(req))) return false;
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
      verifyJwt(token, authSecret);
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
      const payload = verifyJwt(token, authSecret);
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
      const payload = verifyJwt(token, authSecret);
      if (payload?.role !== "admin" && payload?.role !== "owner") {
        const err = new Error("Admin privileges required."); err.statusCode = 403; throw err;
      }
      return true;
    } catch (error) {
      send(res, error?.statusCode || 401, { ok: false, error: error?.message || "Unauthorized" });
      return false;
    }
  }

  let defaultMediaWorker = null;
  function getMediaWorker() {
    if (mediaWorker) return mediaWorker;
    if (!defaultMediaWorker) {
      defaultMediaWorker = createMediaJobWorker({
        store: mediaJobStore,
        eventBus,
        fileStore: resolveFileStore(),
        concurrency: Number(process.env.MEDIA_JOB_CONCURRENCY) || 1,
        runDerivative: ({ job, onProgress }) => runMediaDerivativeImpl({
          type: "transcode",
          key: job.sourceKey,
          params: job.params,
          fileStore: resolveFileStore(),
          onProgress
        }),
        runMontage: async ({ job }) => {
          const outputKey = job.params?.outputKey || montageOutputKey(job);
          const result = await runExport(job.params?.timeline, { rootDir: mediaRootDir });
          return storeMontageOutput({ output: result.output, outputKey, fileStore: resolveFileStore() });
        }
      });
    }
    return defaultMediaWorker;
  }

  return createServer(async (req, res) => {
    // Dev CORS: the SPA on :8080 calling the API on another port. In prod the
    // nginx /api proxy keeps everything same-origin so this stays unset.
    if (corsOrigin) {
      res.setHeader("Access-Control-Allow-Origin", corsOrigin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
    }

    const requestUrl = new URL(req.url || "/", "http://localhost");
    const url = requestUrl.pathname;

    if (req.method === "GET" && (url === "/api/health" || url === "/health")) {
      const config = resolveConfig();
      let db;
      try {
        db = await buildDatabaseHealth(resolveStorage());
      } catch (error) {
        db = { ok: false, latencyMs: 0, error: safeDbError(error) };
      }
      return send(res, 200, {
        ok: true,
        backend,
        engine: backend === "pocketbase" ? "pocketbase" : config.databaseEngine || "postgresql",
        db,
        uptimeSec: Math.floor(process.uptime()),
        version,
        authRequired
      });
    }

    // Login — open endpoint that issues a token. 401 on bad credentials.
    if (req.method === "POST" && url === "/api/auth/login") {
      if (overLimit(res, "login", req)) return undefined;
      if (typeof login !== "function") {
        return send(res, 501, { ok: false, error: "Login not configured on this server." });
      }
      try {
        const body = await readJsonBody(req);
        const result = await login(body);
        return send(res, 200, { ok: true, ...result });
      } catch (error) {
        const statusCode = error?.statusCode || 500;
        return send(res, statusCode, { ok: false, error: error?.message || "Login failed" });
      }
    }

    if (req.method === "POST" && url === "/api/rpc") {
      if (overLimit(res, "rpc", req)) return undefined;
      // Enforce Bearer auth when a secret is configured.
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const result = await dispatch(body);
        return send(res, 200, { ok: true, result });
      } catch (error) {
        const statusCode = error?.statusCode || 500;
        return send(res, statusCode, { ok: false, error: error?.message || "RPC failed" });
      }
    }

    // AI proxy — the SPA's cloud-ai adapter calls this so provider keys stay
    // server-side. Allow-listed methods; 503 when no AI provider is configured.
    if (req.method === "POST" && url === "/api/ai/rpc") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const result = await aiDispatch(body);
        return send(res, 200, { ok: true, result });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "AI request failed" });
      }
    }

    // Transcription — binary audio, so it can't ride the JSON AI RPC. The SPA
    // POSTs the raw audio blob with its Content-Type; we forward to the
    // configured Whisper provider via the registered AiProvider.transcribe.
    if (req.method === "POST" && url.split("?")[0] === "/api/ai/transcribe") {
      if (overLimit(res, "rpc", req)) return undefined;
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
        const result = await runExport(timeline, { rootDir: mediaRootDir });
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
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Export failed" });
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

    // Scoped sharing (G6) — mint a signed public share link. Auth + rate-limited.
    // Body: { scope: { type: "all"|"items"|"collection", ids?: [], label? } }.
    if (req.method === "POST" && url.split("?")[0] === "/api/share") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const expiresInDays = Object.hasOwn(body || {}, "expiresInDays") ? Number(body.expiresInDays) : shareExpiryDays;
        const title = body?.title || body?.scope?.label || "";
        const token = mintShareToken({ scope: body?.scope, secret: shareSecret, expiresInDays, title });
        const payload = readShareTokenPayload(token, shareSecret);
        return send(res, 200, { ok: true, result: { token, path: `/api/share/${token}`, title: payload.title, expiresAt: payload.expiresAt } });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Failed to create share link" });
      }
    }

    // Public read of a share link — NO auth. Returns a privacy-safe, scoped,
    // read-only snapshot (in-scope non-deleted items + reference data only).
    if (req.method === "GET" && url.split("?")[0].startsWith("/api/share/")) {
      if (overLimit(res, "rpc", req)) return undefined;
      const token = decodeURIComponent(url.split("?")[0].slice("/api/share/".length));
      try {
        const share = readShareTokenPayload(token, shareSecret);
        const snapshot = await resolveStorage().snapshot();
        return send(res, 200, { ok: true, result: filterSnapshotForShare(snapshot, share.scope, share) });
      } catch (error) {
        return send(res, error?.statusCode || 404, { ok: false, error: error?.message || "Share link not found" });
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
      if (!requireAuth(req, res)) return undefined;
      const key = decodeURIComponent(url.slice("/api/files/".length));
      try {
        const files = resolveFileStore();
        if (req.method === "PUT") {
          const bytes = await readRawBody(req);
          const result = await files.putBlob(key, bytes, { contentType: req.headers["content-type"] || "" });
          return send(res, 200, { ok: true, result });
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
          await files.remove(key);
          return send(res, 200, { ok: true, result: true });
        }
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "File operation failed" });
      }
    }

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
          verifyJwt(token, authSecret);
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

    return send(res, 404, { ok: false, error: "Not found" });
  });
}

/** Convenience: build + listen. Returns the server so callers can close it. */
export function startApiServer({ port = 8787, host = "0.0.0.0", ...options } = {}) {
  const server = createApiServer(options);
  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`[archive-api] listening on http://${host}:${port} (backend: ${options.backend || "unknown"})`);
  });
  return server;
}
