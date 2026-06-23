// Admin routes — DB config, file store config, Dropbox OAuth,
// users/API-keys, webhooks, saved filters, notification preferences,
// workflow, web push, record versions, bulk record operations,
// search, OCR, AI endpoints, public records API.
// Extracted from api/server.js. No business logic changed.

import { randomUUID } from "node:crypto";
import { logger, createLogger } from "../logger.js";
import { captureException } from "../monitoring/sentryService.js";
import { auditLog } from "../api/auditLogger.js";
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
import { createApiKey, listApiKeys, revokeApiKey, verifyApiKey } from "../auth/apiKeyService.js";
import { getWorkflowDefinition, applyTransition } from "../workflow/stateMachine.js";
import { fireWebhooks } from "../webhooks/webhookService.js";
import { sendPushToUser } from "../notifications/webPushService.js";
import {
  isPushConfigured,
  getVapidPublicKey,
  saveSubscription as savePushSubscription,
  removeSubscription as removePushSubscription,
} from "../notifications/webPushService.js";
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
  limiters,
  PUBLIC_READABLE_STORES,
  clientIp,
  bearerToken,
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

  // ── Saved Filters ─────────────────────────────────────────────────────────

  if (url === "/api/saved-filters" && req.method === "GET") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "المجموعات الذكية غير متاحة في هذا الإعداد." }), true;
    try {
      const filters = await prisma.savedFilter.findMany({
        where: { ownerId: claims.sub },
        orderBy: { updatedAt: "desc" },
      });
      return send(res, 200, { ok: true, filters }), true;
    } catch (err) {
      logger.error({ err }, "saved-filters list failed");
      return send(res, 500, { ok: false, error: "saved_filters_failed" }), true;
    }
  }

  if (url === "/api/saved-filters" && req.method === "POST") {
    if (overLimit(res, "rpc", req)) return true;
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "المجموعات الذكية غير متاحة في هذا الإعداد." }), true;
    try {
      const body = await readJsonBody(req);
      if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
        return send(res, 400, { ok: false, error: "الاسم مطلوب." }), true;
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
      return send(res, 201, { ok: true, filter }), true;
    } catch (err) {
      logger.error({ err }, "saved-filters create failed");
      return send(res, 500, { ok: false, error: "saved_filters_create_failed" }), true;
    }
  }

  if (req.method === "DELETE" && /^\/api\/saved-filters\/[^/]+$/.test(url.split("?")[0])) {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "المجموعات الذكية غير متاحة في هذا الإعداد." }), true;
    try {
      const id = url.split("?")[0].split("/").pop();
      await prisma.savedFilter.deleteMany({ where: { id, ownerId: claims.sub } });
      return send(res, 200, { ok: true }), true;
    } catch (err) {
      logger.error({ err }, "saved-filters delete failed");
      return send(res, 500, { ok: false, error: "saved_filters_delete_failed" }), true;
    }
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  if (url === "/api/webhooks" && req.method === "GET") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "Webhooks غير متاح في هذا الإعداد." }), true;
    try {
      const hooks = await prisma.webhook.findMany({
        where: { ownerId: claims.sub },
        orderBy: { createdAt: "desc" },
      });
      return send(res, 200, { ok: true, hooks }), true;
    } catch (err) {
      logger.error({ err }, "webhooks list failed");
      return send(res, 500, { ok: false, error: "webhooks_list_failed" }), true;
    }
  }

  if (url === "/api/webhooks" && req.method === "POST") {
    if (overLimit(res, "rpc", req)) return true;
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "Webhooks غير متاح في هذا الإعداد." }), true;
    try {
      const body = await readJsonBody(req);
      if (!body.url || typeof body.url !== "string") {
        return send(res, 400, { ok: false, error: "url required" }), true;
      }
      try { new URL(body.url); } catch {
        return send(res, 400, { ok: false, error: "invalid url" }), true;
      }
      const ALLOWED_EVENTS = ["record.created", "record.updated", "record.deleted", "record.restored"];
      const events = Array.isArray(body.events)
        ? body.events.filter((e) => ALLOWED_EVENTS.includes(e))
        : ALLOWED_EVENTS;
      const secret = body.secret || randomUUID().replace(/-/g, "");
      const hook = await prisma.webhook.create({
        data: { url: String(body.url).slice(0, 500), events, secret, active: true, ownerId: claims.sub },
      });
      return send(res, 201, { ok: true, hook }), true;
    } catch (err) {
      logger.error({ err }, "webhooks create failed");
      return send(res, 500, { ok: false, error: "webhooks_create_failed" }), true;
    }
  }

  if (req.method === "DELETE" && /^\/api\/webhooks\/[^/]+$/.test(url.split("?")[0])) {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "Webhooks غير متاح في هذا الإعداد." }), true;
    try {
      const id = url.split("?")[0].split("/").pop();
      await prisma.webhook.deleteMany({ where: { id, ownerId: claims.sub } });
      return send(res, 200, { ok: true }), true;
    } catch (err) {
      logger.error({ err }, "webhooks delete failed");
      return send(res, 500, { ok: false, error: "webhooks_delete_failed" }), true;
    }
  }

  // ── Notification preferences ──────────────────────────────────────────────

  if (url.split("?")[0] === "/api/notification-preferences" && req.method === "GET") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) {
      return (
        send(res, 200, { ok: true, prefs: { emailOnShare: true, emailOnUpload: false, emailOnMention: true } }),
        true
      );
    }
    try {
      const prefs =
        (await prisma.notificationPreference.findUnique({ where: { userId: claims.sub } })) ??
        { emailOnShare: true, emailOnUpload: false, emailOnMention: true };
      return send(res, 200, { ok: true, prefs }), true;
    } catch (err) {
      logger.warn({ err }, "notification-preferences GET failed");
      return send(res, 500, { ok: false, error: "failed" }), true;
    }
  }

  if (url.split("?")[0] === "/api/notification-preferences" && req.method === "PATCH") {
    if (overLimit(res, "rpc", req)) return true;
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) {
      return send(res, 501, { ok: false, error: "Notification preferences غير متاحة في هذا الإعداد." }), true;
    }
    try {
      const body = await readJsonBody(req);
      const data = {};
      const boolFields = ["emailOnShare", "emailOnUpload", "emailOnMention", "pushOnShare", "pushOnUpload", "pushOnMention", "pushOnSystem"];
      for (const field of boolFields) {
        if (typeof body[field] === "boolean") data[field] = body[field];
      }
      if (Object.keys(data).length === 0) {
        return send(res, 400, { ok: false, error: "No valid preference fields provided." }), true;
      }
      const prefs = await prisma.notificationPreference.upsert({
        where: { userId: claims.sub },
        create: { id: randomUUID(), userId: claims.sub, ...data },
        update: data,
      });
      return send(res, 200, { ok: true, prefs }), true;
    } catch (err) {
      logger.warn({ err }, "notification-preferences PATCH failed");
      return send(res, 500, { ok: false, error: "failed" }), true;
    }
  }

  // ── API keys ──────────────────────────────────────────────────────────────

  if (url.split("?")[0] === "/api/api-keys" && req.method === "GET") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "مفاتيح API غير متاحة في هذا الإعداد." }), true;
    try {
      return send(res, 200, { ok: true, keys: await listApiKeys(prisma, claims.sub) }), true;
    } catch (err) {
      logger.warn({ err: err?.message }, "api-keys list failed");
      return send(res, 500, { ok: false, error: "failed" }), true;
    }
  }

  if (url.split("?")[0] === "/api/api-keys" && req.method === "POST") {
    if (overLimit(res, "rpc", req)) return true;
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "مفاتيح API غير متاحة في هذا الإعداد." }), true;
    try {
      const body = await readJsonBody(req);
      const wantsWrite = Array.isArray(body?.scopes) && body.scopes.includes("write");
      if (wantsWrite && !["editor", "admin", "owner"].includes(claims.role)) {
        return send(res, 403, { ok: false, error: "نطاق الكتابة يتطلّب صلاحية محرّر أو أعلى." }), true;
      }
      const created = await createApiKey(prisma, {
        name: body?.name,
        scopes: body?.scopes,
        ownerId: claims.sub,
        expiresAt: body?.expiresAt,
      });
      authLog.info(
        { event: "api_key_create", sub: claims.sub, prefix: created.prefix, ip: clientIp(req) },
        "AUDIT: API key created"
      );
      return send(res, 201, { ok: true, apiKey: created }), true;
    } catch (err) {
      return send(res, err?.statusCode || 500, { ok: false, error: err?.message || "failed" }), true;
    }
  }

  if (url.split("?")[0].startsWith("/api/api-keys/") && req.method === "DELETE") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "مفاتيح API غير متاحة في هذا الإعداد." }), true;
    const id = decodeURIComponent(url.split("?")[0].slice("/api/api-keys/".length));
    try {
      const removed = await revokeApiKey(prisma, claims.sub, id);
      if (!removed) return send(res, 404, { ok: false, error: "المفتاح غير موجود." }), true;
      authLog.info(
        { event: "api_key_revoke", sub: claims.sub, id, ip: clientIp(req) },
        "AUDIT: API key revoked"
      );
      return send(res, 200, { ok: true }), true;
    } catch {
      return send(res, 500, { ok: false, error: "failed" }), true;
    }
  }

  // GET /api/public/records — public programmatic read via X-API-Key
  if (url.split("?")[0] === "/api/public/records" && req.method === "GET") {
    if (overLimit(res, "rpc", req)) return true;
    const presented = req.headers["x-api-key"] || req.headers["X-API-Key"];
    const principal = await verifyApiKey(prisma, Array.isArray(presented) ? presented[0] : presented);
    if (!principal) return send(res, 401, { ok: false, error: "مفتاح API غير صالح أو منتهٍ." }), true;
    if (!principal.scopes.includes("read")) return send(res, 403, { ok: false, error: "نطاق القراءة غير ممنوح." }), true;
    if (limiters && !limiters.apiKey.check(principal.apiKeyId)) {
      return send(res, 429, { ok: false, error: "تجاوزت حدّ الطلبات لهذا المفتاح." }), true;
    }
    try {
      const params = requestUrl.searchParams;
      const store = String(params.get("store") || "video_items");
      if (!PUBLIC_READABLE_STORES.has(store)) {
        return send(res, 403, { ok: false, error: "هذا المخزن غير متاح للقراءة العامة." }), true;
      }
      const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 200);
      const cursor = params.get("cursor") || "";
      const all = await resolveStorage().getAll(store).catch(() => []);
      const sorted = [...all].sort((a, b) =>
        String(a?.id ?? a?.uid ?? "").localeCompare(String(b?.id ?? b?.uid ?? ""))
      );
      const startIdx = cursor
        ? sorted.findIndex((r) => String(r?.id ?? r?.uid ?? "") > cursor)
        : 0;
      const begin = startIdx === -1 ? sorted.length : startIdx;
      const page = sorted.slice(begin, begin + limit);
      const hasMore = begin + limit < sorted.length;
      const nextCursor =
        hasMore && page.length
          ? String(page[page.length - 1]?.id ?? page[page.length - 1]?.uid ?? "")
          : null;
      return send(res, 200, { ok: true, store, count: all.length, records: page, nextCursor }), true;
    } catch {
      return send(res, 500, { ok: false, error: "failed" }), true;
    }
  }

  // ── Workflow ──────────────────────────────────────────────────────────────

  if (url.split("?")[0] === "/api/workflow/definition" && req.method === "GET") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    return send(res, 200, { ok: true, definition: getWorkflowDefinition() }), true;
  }

  if (url.split("?")[0] === "/api/workflow/transition" && req.method === "POST") {
    if (overLimit(res, "rpc", req)) return true;
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    try {
      const body = await readJsonBody(req);
      const store = String(body?.store || "video_items");
      const id = String(body?.id || "");
      if (!id) return send(res, 400, { ok: false, error: "معرّف السجل مطلوب." }), true;
      const storage = resolveStorage();
      const existing =
        typeof storage.get === "function"
          ? await storage.get(store, id)
          : (await storage.getAll(store).catch(() => [])).find((r) => String(r?.id) === id);
      if (!existing) return send(res, 404, { ok: false, error: "السجل غير موجود." }), true;
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
      return (
        send(res, 200, {
          ok: true,
          result: { id, status: record.workflowStatus, dueDate: record.workflowDueDate, entry },
        }),
        true
      );
    } catch (error) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "فشل تغيير الحالة." }), true;
    }
  }

  // ── Web Push ──────────────────────────────────────────────────────────────

  if (url.split("?")[0] === "/api/push/vapid-public-key" && req.method === "GET") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!isPushConfigured()) {
      return send(res, 501, { ok: false, error: "Web Push غير مهيأ على هذا الخادم (VAPID keys)." }), true;
    }
    return send(res, 200, { ok: true, key: getVapidPublicKey() }), true;
  }

  if (url.split("?")[0] === "/api/push/subscribe" && req.method === "POST") {
    if (overLimit(res, "rpc", req)) return true;
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "Web Push غير متاح في هذا الإعداد." }), true;
    try {
      const body = await readJsonBody(req);
      await savePushSubscription(prisma, claims.sub, body?.subscription || body);
      return send(res, 200, { ok: true }), true;
    } catch (err) {
      logger.warn({ err: err?.message }, "push subscribe failed");
      return send(res, err?.statusCode || 500, { ok: false, error: err?.message || "failed" }), true;
    }
  }

  if (url.split("?")[0] === "/api/push/unsubscribe" && req.method === "POST") {
    if (overLimit(res, "rpc", req)) return true;
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "Web Push غير متاح في هذا الإعداد." }), true;
    try {
      const body = await readJsonBody(req);
      await removePushSubscription(prisma, claims.sub, body?.endpoint);
      return send(res, 200, { ok: true }), true;
    } catch (err) {
      logger.warn({ err: err?.message }, "push unsubscribe failed");
      return send(res, err?.statusCode || 500, { ok: false, error: err?.message || "failed" }), true;
    }
  }

  // ── Record version history ────────────────────────────────────────────────

  if (req.method === "GET" && /^\/api\/records\/[^/]+\/versions$/.test(url.split("?")[0])) {
    if (!requireAuth(req, res)) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "السجل التاريخي غير متاح في هذا الإعداد." }), true;
    try {
      const uid = url.split("?")[0].split("/")[3];
      const store = requestUrl.searchParams.get("store") ?? "videoItems";
      const versions = await prisma.recordVersion.findMany({
        where: { store, recordUid: uid },
        orderBy: { version: "desc" },
        take: 50,
        select: { id: true, version: true, userId: true, createdAt: true },
      });
      return send(res, 200, { ok: true, versions }), true;
    } catch (err) {
      logger.error({ err }, "versions list failed");
      return send(res, 500, { ok: false, error: "versions_failed" }), true;
    }
  }

  if (req.method === "POST" && /^\/api\/records\/[^/]+\/restore\/\d+$/.test(url.split("?")[0])) {
    if (!requireEditor(req, res)) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "الاستعادة غير متاحة في هذا الإعداد." }), true;
    try {
      const parts = url.split("?")[0].split("/");
      const uid = parts[3];
      const version = parseInt(parts[5], 10);
      const store = requestUrl.searchParams.get("store") ?? "videoItems";
      const versionRow = await prisma.recordVersion.findFirst({ where: { store, recordUid: uid, version } });
      if (!versionRow) return send(res, 404, { ok: false, error: "version_not_found" }), true;
      await resolveStorage().put(store, versionRow.snapshot);
      return send(res, 200, { ok: true, restoredVersion: version }), true;
    } catch (err) {
      logger.error({ err }, "version restore failed");
      return send(res, 500, { ok: false, error: "restore_failed" }), true;
    }
  }

  // ── Bulk record operations ────────────────────────────────────────────────

  if (req.method === "POST" && url.split("?")[0] === "/api/records/bulk") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAuth(req, res)) return true;
    try {
      const body = await readJsonBody(req);
      const ALLOWED_ACTIONS = ["addTags", "removeTags", "setType", "setProject", "delete"];
      if (!ALLOWED_ACTIONS.includes(body.action)) {
        return send(res, 400, { ok: false, error: "invalid_action" }), true;
      }
      if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > 500) {
        return send(res, 400, { ok: false, error: "ids must be array of 1-500" }), true;
      }
      const store = typeof body.store === "string" && body.store ? body.store : "videoItems";
      const provider = resolveStorage();
      const ids = body.ids.map(String);
      let affected = 0;
      if (body.action === "delete") {
        await provider.deleteBatch(store, ids);
        affected = ids.length;
      } else {
        const allRecords = await provider.getAll(store).catch(() => []);
        const idSet = new Set(ids);
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
        if (updated.length) await provider.putBatch(store, updated);
        affected = updated.length;
      }
      return send(res, 200, { ok: true, affected }), true;
    } catch (error) {
      const statusCode = error?.statusCode || 500;
      if (statusCode >= 500) captureException(error, { endpoint: "records/bulk", reqId: req.id });
      logger.error({ err: error }, "bulk operation failed");
      return send(res, statusCode, { ok: false, error: error?.message || "bulk_failed" }), true;
    }
  }

  return false; // not handled
}
