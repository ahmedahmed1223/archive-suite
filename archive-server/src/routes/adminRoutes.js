// Admin routes — DB config, file store config, Dropbox OAuth,
// search, OCR, AI endpoints.
// Extracted from api/server.js. No business logic changed.
// User-data routes (saved-filters, webhooks, workflow, push, API-keys, etc.)
// live in userDataRoutes.js.

import { logger, createLogger } from "../logger.js";
import { config } from "../config/env.js";
import {
  buildConfigView,
  validateDbConfig,
  mergeDbConfig,
  validateFileStoreConfig,
  mergeFileStoreConfig,
} from "../api/adminConfig.js";
import {
  buildDropboxOAuthUrl,
  createDropboxOAuthState,
  exchangeDropboxOAuthCode,
  readDropboxOAuthState,
} from "../dropbox/oauth.js";
import { handleSearch } from "../api/searchHandler.js";
import { handleOcr } from "../api/ocrHandler.js";

const authLog = createLogger("auth");

function requestOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim() || "http";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

/**
 * Handles admin, workflow, push, API-key, search, OCR, and AI routes.
 * Returns true if the request was handled.
 */
export async function handleAdminRoute({
  req,
  res,
  url,
  requestUrl,
  send,
  overLimit,
  overLimitUser,
  readJsonBody,
  requireAuth,
  requireAuthClaims,
  requireAdmin,
  requireEditor,
  resolveStorage,
  resolveConfig,
  loadConfigFile,
  saveConfig,
  testDbConnection,
  buildFileStoreCandidate,
  testFileStore,
  resolvedAuthSecret,
  oauthSecret,
  dropboxOAuthFetch,
  prisma,
  aiResolveProvider,
  clientIp,
  bearerToken,
  // limiters and PUBLIC_READABLE_STORES forwarded transparently (unused here)
}) {
  // ── Dropbox OAuth ─────────────────────────────────────────────────────────

  if (req.method === "POST" && url.split("?")[0] === "/api/admin/dropbox/oauth/start") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAdmin(req, res)) return true;
    try {
      const body = await readJsonBody(req);
      const cfg = resolveConfig();
      const appKey = String(body?.appKey || cfg.dropboxAppKey || "").trim();
      const redirectUri = String(
        body?.redirectUri ||
          config.dropboxRedirectUri ||
          `${requestOrigin(req)}/api/dropbox/oauth/callback`
      ).trim();
      const state = createDropboxOAuthState({
        secret: oauthSecret,
        rootPath: body?.rootPath ?? cfg.dropboxRootPath ?? "",
        selectUser: body?.selectUser ?? cfg.dropboxSelectUser ?? "",
        selectAdmin: body?.selectAdmin ?? cfg.dropboxSelectAdmin ?? "",
        redirectUri,
        returnTo: body?.returnTo || `${requestOrigin(req)}/?page=settings&dropbox=connected`,
      });
      const authUrl = buildDropboxOAuthUrl({
        appKey,
        redirectUri,
        state,
        forceReapprove: Boolean(body?.forceReapprove),
      });
      return send(res, 200, { ok: true, result: { authUrl, redirectUri } }), true;
    } catch (error) {
      return send(res, error?.statusCode || 400, { ok: false, error: error?.message || "Dropbox OAuth start failed" }), true;
    }
  }

  if (req.method === "GET" && url.split("?")[0] === "/api/dropbox/oauth/callback") {
    try {
      const code = requestUrl.searchParams.get("code") || "";
      const state = readDropboxOAuthState(requestUrl.searchParams.get("state") || "", oauthSecret);
      const cfg = resolveConfig();
      const token = await exchangeDropboxOAuthCode({
        code,
        appKey: cfg.dropboxAppKey,
        appSecret: cfg.dropboxAppSecret,
        redirectUri: state.redirectUri,
        fetchImpl: dropboxOAuthFetch,
      });
      const merged = mergeFileStoreConfig(loadConfigFile(), {
        kind: "dropbox",
        dropbox: {
          accessToken: token.accessToken,
          accessTokenExpiresAt: token.expiresAt,
          refreshToken: token.refreshToken,
          rootPath: state.rootPath,
          selectUser: state.selectUser,
          selectAdmin: state.selectAdmin,
        },
      });
      saveConfig(merged);
      const target = new URL(state.returnTo || "/", requestOrigin(req));
      target.searchParams.set("dropbox", "connected");
      return redirect(res, target.toString()), true;
    } catch (error) {
      return send(res, error?.statusCode || 400, { ok: false, error: error?.message || "Dropbox OAuth callback failed" }), true;
    }
  }

  // ── Admin: DB configuration ───────────────────────────────────────────────

  if (req.method === "GET" && url.split("?")[0] === "/api/admin/config") {
    if (!requireAdmin(req, res)) return true;
    return send(res, 200, { ok: true, result: buildConfigView(resolveConfig()) }), true;
  }

  if (req.method === "POST" && url.split("?")[0] === "/api/admin/db/test") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAdmin(req, res)) return true;
    try {
      const body = await readJsonBody(req);
      const candidate = validateDbConfig(body);
      const result = await testDbConnection(candidate);
      return send(res, 200, { ok: true, result }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Test failed" }), true;
    }
  }

  if (req.method === "POST" && url.split("?")[0] === "/api/admin/config") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAdmin(req, res)) return true;
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
        return send(res, 400, { ok: false, error: "لا توجد إعدادات قابلة للحفظ." }), true;
      }
      saveConfig(merged);
      const view = buildConfigView(resolveConfig({ file: merged, env: {} }));
      return send(res, 200, { ok: true, result: { saved: true, restartRequired: true, ...view } }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Save failed" }), true;
    }
  }

  if (req.method === "POST" && url.split("?")[0] === "/api/files/test-provider") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAdmin(req, res)) return true;
    try {
      const candidate = validateFileStoreConfig(await readJsonBody(req));
      const merged = mergeFileStoreConfig(loadConfigFile(), candidate);
      const resolved = resolveConfig({ file: merged, env: process.env });
      const store = buildFileStoreCandidate({
        fileStore: candidate.kind,
        fileStoreOptions: resolved.fileStoreOptions,
        resolveConfig: () => resolved,
      });
      const result = await testFileStore(store);
      return (
        send(res, result.ok ? 200 : 502, {
          ok: result.ok,
          result,
          ...(result.ok ? {} : { error: result.error }),
        }),
        true
      );
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "FileStore test failed" }), true;
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────

  if (url.split("?")[0] === "/api/search" && req.method === "GET") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAuth(req, res)) return true;
    return handleSearch(req, res, { provider: resolveStorage(), prisma, authSecret: resolvedAuthSecret }), true;
  }

  // ── OCR ───────────────────────────────────────────────────────────────────

  if (url.split("?")[0] === "/api/ocr" && req.method === "POST") {
    if (overLimit(res, "ocr", req)) return true;
    if (overLimitUser(res, req)) return true;
    if (!requireAuth(req, res)) return true;
    return handleOcr(req, res), true;
  }

  // ── AI endpoints ──────────────────────────────────────────────────────────

  if (req.method === "POST" && url.split("?")[0] === "/api/ai/suggest-tags") {
    if (overLimit(res, "ai", req)) return true;
    if (overLimitUser(res, req)) return true;
    if (!requireAuth(req, res)) return true;
    try {
      const provider = aiResolveProvider();
      if (typeof provider?.suggestTags !== "function") {
        return send(res, 503, { ok: false, error: "خدمة اقتراح الوسوم غير مُهيّأة على الخادم." }), true;
      }
      const body = await readJsonBody(req);
      const { name, summary, transcription, categories } = body || {};
      const result = await provider.suggestTags({ name, summary, transcription, categories });
      return send(res, 200, { ok: true, tags: result?.tags ?? [], categoryIds: result?.categoryIds ?? [] }), true;
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Tag suggestion failed" }), true;
    }
  }

  return false; // not handled
}
