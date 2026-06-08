import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import { getFileStore, getSyncProvider, getAiProvider, getStorageProvider } from "@archive/core";

import { logger, createLogger } from "../logger.js";
import { auditLog } from "./auditLogger.js";
import { dispatchRpc } from "./rpcHandler.js";
import { dispatchAi } from "./aiHandler.js";
import { handleSearch } from "./searchHandler.js";
import { exportTimelineToMp4 } from "../export/mp4.js";
import { createInMemoryMediaJobStore, createMediaJobWorker, montageOutputKey, storeMontageOutput } from "../media/mediaJobs.js";
import { runMediaDerivative, runMediaProbe } from "../media/runMedia.js";
import { verifyJwt, signJwt } from "../auth/jwt.js";
import { revokeToken } from "../auth/tokenBlacklist.js";
import { generateTotpSecret, verifyTotpToken } from "../auth/totpService.js";
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
import { captureException } from "../monitoring/sentryService.js";
import { listBackups, runBackup } from "../backup/backupScheduler.js";
import {
  getMetricsOutput, getContentType,
  incActiveRequests, decActiveRequests, recordRequest
} from "../monitoring/metrics.js";
import { handleOcr } from "./ocrHandler.js";
import { processImage, detectImageMimeType, PROCESSABLE_IMAGE_TYPES } from "../media/imageProcessor.js";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail, sendMail } from "../auth/emailService.js";
import { createResetToken, consumeResetToken } from "../auth/resetTokenStore.js";
import { notifyRecordShared } from "../notifications/notificationService.js";

// Minimal dependency-free HTTP server exposing the StorageProvider port to the
// SPA over a single RPC endpoint. Node's built-in http keeps the runtime image
// tiny and the attack surface small (no Express middleware chain).
//
// Routes:
//   GET    /api/health                  → { ok, backend, authRequired }
//   POST   /api/auth/login              → { ok, token, user }   body: { username, password[, totpToken] }
//   POST   /api/auth/logout             → { ok }                (Bearer JWT required)
//   POST   /api/auth/request-reset      → { ok, message }       body: { username }  (open; rate-limited)
//   POST   /api/auth/reset-password     → { ok, message }       body: { token, newPassword } (open; rate-limited)
//   POST   /api/auth/totp/setup         → { ok, otpauthUrl, qrUrl }  (Bearer required)
//   POST   /api/auth/totp/verify        → { ok }                body: { token }  (Bearer required; activates 2FA)
//   DELETE /api/auth/totp               → { ok }                body: { token }  (Bearer required; disables 2FA)
//   POST   /api/rpc                     → { ok, result } | { ok:false, error }
//                                         body: { method, args }   (Bearer JWT required when authSecret set)
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
  prisma = null,
  resolveConfig = resolveServerConfig,
  loadConfigFile = loadServerConfigFile,
  saveConfig = saveServerConfigFile,
  testDbConnection = testDatabaseConnection,
  version = process.env.npm_package_version || process.env.APP_VERSION || "0.0.0",
  dropboxOAuthFetch
} = {}) {
  // Prefer dedicated per-token-type secrets; fall back to the legacy JWT_SECRET
  // (via authSecret/shareSecret) so existing deployments keep working.
  const resolvedAuthSecret   = process.env.JWT_AUTH_SECRET    || authSecret;
  const resolvedShareSecret  = process.env.JWT_SHARE_SECRET   || shareSecret;
  const resolvedOauthSecret  = process.env.OAUTH_STATE_SECRET || resolvedAuthSecret || resolvedShareSecret;

  const authRequired = Boolean(resolvedAuthSecret);
  const oauthSecret = resolvedOauthSecret;

  // Three buckets: a generous one for RPC, a strict one for login (brute-force
  // defense), and a strict one for password reset requests. Disabled entirely
  // when rateLimit is null (e.g. some tests).
  const limiters = rateLimit === null ? null : {
    rpc: createRateLimiter({ max: rateLimit.rpcMax ?? 600, windowMs: rateLimit.windowMs ?? 60_000 }),
    login: createRateLimiter({ max: rateLimit.loginMax ?? 10, windowMs: rateLimit.windowMs ?? 60_000 }),
    reset: createRateLimiter({ max: rateLimit.resetMax ?? 5, windowMs: rateLimit.windowMs ?? 60_000 })
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
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
        return send(res, 200, { ok: true, ...result });
      } catch (error) {
        const statusCode = error?.statusCode || 500;
        return send(res, statusCode, { ok: false, error: error?.message || "Login failed" });
      }
    }

    // Logout — revoke the caller's current token so it can no longer be used
    // even before its `exp` expires. Requires a valid Bearer token.
    if (req.method === "POST" && url === "/api/auth/logout") {
      if (!authRequired) return send(res, 200, { ok: true, message: "تم تسجيل الخروج بنجاح." });
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
        await resolveStorage().put("users", {
          id: claims.sub,
          totpSecret: user.totpSecretPending,
          totpSecretPending: null,
          totpEnabled: true,
        });
        return send(res, 200, { ok: true, message: "تم تفعيل المصادقة الثنائية بنجاح." });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "TOTP verify failed" });
      }
    }

    // DELETE /api/auth/totp — disable 2FA. Requires the current TOTP code to
    // prevent account takeover if a session token is stolen.
    if (req.method === "DELETE" && url === "/api/auth/totp") {
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
        });
        return send(res, 200, { ok: true, message: "تم تعطيل المصادقة الثنائية." });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "TOTP disable failed" });
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
      if (overLimit(res, "rpc", req)) return undefined;
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
        const statusCode = error?.statusCode || 500;
        if (statusCode >= 500) captureException(error, { endpoint: "projects/export", reqId: req.id });
        return send(res, statusCode, { ok: false, error: error?.message || "Export failed" });
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
    // Body: { scope: { type: "all"|"items"|"collection", ids?: [], label? },
    //         sharedWithUserId?: string }  — optional for user-to-user share notifications.
    if (req.method === "POST" && url.split("?")[0] === "/api/share") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const expiresInDays = Object.hasOwn(body || {}, "expiresInDays") ? Number(body.expiresInDays) : shareExpiryDays;
        const title = body?.title || body?.scope?.label || "";
        const token = mintShareToken({ scope: body?.scope, secret: resolvedShareSecret, expiresInDays, title });
        const payload = readShareTokenPayload(token, resolvedShareSecret);
        const shareUrl = `${requestOrigin(req)}/api/share/${token}`;

        // Fire-and-forget email to the recipient (if caller specified a target user).
        if (body?.sharedWithUserId) {
          const senderClaims = (() => { try { return verifyJwt(bearerToken(req), resolvedAuthSecret); } catch { return null; } })();
          notifyRecordShared({
            prisma,
            sendMail,
            sharedWithUserId: body.sharedWithUserId,
            sharedByUsername: senderClaims?.username,
            recordTitle: title,
            shareUrl,
          });
        }

        return send(res, 200, { ok: true, result: { token, path: `/api/share/${token}`, title: payload.title, expiresAt: payload.expiresAt, jti: payload.jti } });
      } catch (error) {
        return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Failed to create share link" });
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
        const share = readShareTokenPayload(token, resolvedShareSecret);
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
          const declaredMime = req.headers["content-type"] || "";
          const detectedMime = detectImageMimeType(bytes) || declaredMime;

          // Run image processing pipeline for supported image types.
          // Stores srcset-ready WebP variants alongside the original.
          // Gracefully no-ops if Sharp is unavailable or the file is not an image.
          let imageMetadata = null;
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

          const result = await files.putBlob(key, bytes, { contentType: declaredMime });
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
      if (overLimit(res, "rpc", req)) return undefined;
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

    // POST /api/export — export archive records as csv, xlsx, or json
    if (req.method === "POST" && url.split("?")[0] === "/api/export") {
      if (overLimit(res, "rpc", req)) return undefined;
      if (!requireAuth(req, res)) return undefined;
      try {
        const body = await readJsonBody(req);
        const format = ["csv", "xlsx", "zip"].includes(body.format) ? body.format : "csv";
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
      if (overLimit(res, "rpc", req)) return undefined;
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
