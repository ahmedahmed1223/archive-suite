// User-data routes — saved filters, webhooks, notification preferences,
// API keys, public records, workflow, web push, record versions, bulk ops.
// Extracted from adminRoutes.js to keep file size under 400 lines.

import { randomUUID } from "node:crypto";
import { logger, createLogger } from "../logger.js";
import { captureException } from "../monitoring/sentryService.js";
import { createApiKey, listApiKeys, revokeApiKey, verifyApiKey } from "../auth/apiKeyService.js";
import { getWorkflowDefinition, applyTransition } from "../workflow/stateMachine.js";
import { fireWebhooks } from "../webhooks/webhookService.js";
import {
  isPushConfigured,
  getVapidPublicKey,
  saveSubscription as savePushSubscription,
  removeSubscription as removePushSubscription,
  sendPushToUser,
} from "../notifications/webPushService.js";

const authLog = createLogger("auth");

/**
 * Handles user-data routes: saved-filters, webhooks, notification-preferences,
 * API keys, public records, workflow, push, record versions, bulk operations.
 * Returns true if the request was handled.
 */
export async function handleUserDataRoute({
  req,
  res,
  url,
  requestUrl,
  send,
  overLimit,
  readJsonBody,
  requireAuth,
  requireEditor,
  requireAuthClaims,
  resolveStorage,
  prisma,
  limiters,
  PUBLIC_READABLE_STORES,
  clientIp,
}: any): Promise<boolean> {
  // ── Saved Filters ─────────────────────────────────────────────────────────

  if (url === "/api/saved-filters" && req.method === "GET") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!prisma) return send(res, 501, { ok: false, error: "المجموعات الذكية غير متاحة في هذا الإعداد." }), true;
    try {
      const filters = await prisma.savedFilter.findMany({ where: { ownerId: claims.sub }, orderBy: { updatedAt: "desc" } });
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
        data: { id: randomUUID(), name: String(body.name).trim().slice(0, 100), query: body.query ?? {}, isLive: Boolean(body.isLive), ownerId: claims.sub },
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
      const hooks = await prisma.webhook.findMany({ where: { ownerId: claims.sub }, orderBy: { createdAt: "desc" } });
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
      if (!body.url || typeof body.url !== "string") return send(res, 400, { ok: false, error: "url required" }), true;
      try { new URL(body.url); } catch { return send(res, 400, { ok: false, error: "invalid url" }), true; }
      const ALLOWED_EVENTS = ["record.created", "record.updated", "record.deleted", "record.restored"];
      const events = Array.isArray(body.events) ? body.events.filter((e: string) => ALLOWED_EVENTS.includes(e)) : ALLOWED_EVENTS;
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
    if (!prisma) return send(res, 200, { ok: true, prefs: { emailOnShare: true, emailOnUpload: false, emailOnMention: true } }), true;
    try {
      const prefs = (await prisma.notificationPreference.findUnique({ where: { userId: claims.sub } }))
        ?? { emailOnShare: true, emailOnUpload: false, emailOnMention: true };
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
    if (!prisma) return send(res, 501, { ok: false, error: "Notification preferences غير متاحة في هذا الإعداد." }), true;
    try {
      const body = await readJsonBody(req);
      const data: any = {};
      for (const f of ["emailOnShare", "emailOnUpload", "emailOnMention", "pushOnShare", "pushOnUpload", "pushOnMention", "pushOnSystem"]) {
        if (typeof body[f] === "boolean") data[f] = body[f];
      }
      if (Object.keys(data).length === 0) return send(res, 400, { ok: false, error: "No valid preference fields provided." }), true;
      const prefs = await prisma.notificationPreference.upsert({
        where: { userId: claims.sub }, create: { id: randomUUID(), userId: claims.sub, ...data }, update: data,
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
      logger.warn({ err: (err as any)?.message }, "api-keys list failed");
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
      const created = await createApiKey(prisma, { name: body?.name, scopes: body?.scopes, ownerId: claims.sub, expiresAt: body?.expiresAt });
      authLog.info({ event: "api_key_create", sub: claims.sub, prefix: created.prefix, ip: clientIp(req) }, "AUDIT: API key created");
      return send(res, 201, { ok: true, apiKey: created }), true;
    } catch (err: any) {
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
      authLog.info({ event: "api_key_revoke", sub: claims.sub, id, ip: clientIp(req) }, "AUDIT: API key revoked");
      return send(res, 200, { ok: true }), true;
    } catch { return send(res, 500, { ok: false, error: "failed" }), true; }
  }

  // GET /api/public/records — public programmatic read via X-API-Key
  if (url.split("?")[0] === "/api/public/records" && req.method === "GET") {
    if (overLimit(res, "rpc", req)) return true;
    const presented = req.headers["x-api-key"] || req.headers["X-API-Key"];
    const principal = await verifyApiKey(prisma, Array.isArray(presented) ? presented[0] : presented);
    if (!principal) return send(res, 401, { ok: false, error: "مفتاح API غير صالح أو منتهٍ." }), true;
    if (!principal.scopes.includes("read")) return send(res, 403, { ok: false, error: "نطاق القراءة غير ممنوح." }), true;
    if (limiters && !limiters.apiKey.check(principal.apiKeyId)) return send(res, 429, { ok: false, error: "تجاوزت حدّ الطلبات لهذا المفتاح." }), true;
    try {
      const params = requestUrl.searchParams;
      const store = String(params.get("store") || "video_items");
      if (!PUBLIC_READABLE_STORES.has(store)) return send(res, 403, { ok: false, error: "هذا المخزن غير متاح للقراءة العامة." }), true;
      const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 200);
      const cursor = params.get("cursor") || "";
      const all = await resolveStorage().getAll(store).catch(() => []);
      const sorted = [...all].sort((a: any, b: any) => String(a?.id ?? a?.uid ?? "").localeCompare(String(b?.id ?? b?.uid ?? "")));
      const startIdx = cursor ? sorted.findIndex((r: any) => String(r?.id ?? r?.uid ?? "") > cursor) : 0;
      const begin = startIdx === -1 ? sorted.length : startIdx;
      const page = sorted.slice(begin, begin + limit);
      const hasMore = begin + limit < sorted.length;
      const nextCursor = hasMore && page.length ? String(page[page.length - 1]?.id ?? page[page.length - 1]?.uid ?? "") : null;
      return send(res, 200, { ok: true, store, count: all.length, records: page, nextCursor }), true;
    } catch { return send(res, 500, { ok: false, error: "failed" }), true; }
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
      const existing = typeof storage.get === "function"
        ? await storage.get(store, id)
        : (await storage.getAll(store).catch(() => [])).find((r: any) => String(r?.id) === id);
      if (!existing) return send(res, 404, { ok: false, error: "السجل غير موجود." }), true;
      const { record, entry } = applyTransition(existing, {
        to: body?.to, role: claims.role || "viewer", userId: claims.sub,
        username: claims.username, dueDate: body?.dueDate, note: body?.note,
      });
      await storage.put(store, record);
      authLog.info({ event: "workflow_transition", store, id, from: entry.from, to: entry.to, sub: claims.sub }, "AUDIT: workflow transition");
      const recordOwnerId = (record as any)?.ownerId;
      fireWebhooks(prisma, "record.status_changed", { store, uid: id, from: entry.from, to: entry.to }, recordOwnerId, logger);
      if (recordOwnerId && recordOwnerId !== claims.sub) {
        const recordTitle = (record as any)?.title || id;
        sendPushToUser({ prisma, userId: recordOwnerId, type: "system",
          title: `تغيّرت حالة السجل — ${recordTitle}`,
          body: `من «${entry.from}» إلى «${entry.to}» بواسطة ${claims.username || "مستخدم"}`,
          tag: `workflow:${id}` });
      }
      return send(res, 200, { ok: true, result: { id, status: record.workflowStatus, dueDate: record.workflowDueDate, entry } }), true;
    } catch (error: any) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "فشل تغيير الحالة." }), true;
    }
  }

  // ── Web Push ──────────────────────────────────────────────────────────────

  if (url.split("?")[0] === "/api/push/vapid-public-key" && req.method === "GET") {
    const claims = requireAuthClaims(req, res);
    if (!claims) return true;
    if (!isPushConfigured()) return send(res, 501, { ok: false, error: "Web Push غير مهيأ على هذا الخادم (VAPID keys)." }), true;
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
    } catch (err: any) {
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
    } catch (err: any) {
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
        where: { store, recordUid: uid }, orderBy: { version: "desc" }, take: 50,
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
      if (!ALLOWED_ACTIONS.includes(body.action)) return send(res, 400, { ok: false, error: "invalid_action" }), true;
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
        const toUpdate = Array.isArray(allRecords) ? allRecords.filter((r: any) => r && idSet.has(String(r.id ?? r.uid ?? ""))) : [];
        const updated = toUpdate.map((record: any) => {
          const d = { ...record };
          if (body.action === "addTags") {
            const existing = new Set(Array.isArray(d.tags) ? d.tags : []);
            (body.tags ?? []).forEach((t: any) => existing.add(String(t).trim().toLowerCase()));
            d.tags = [...existing];
          } else if (body.action === "removeTags") {
            const toRemove = new Set((body.tags ?? []).map((t: any) => String(t).trim().toLowerCase()));
            d.tags = (Array.isArray(d.tags) ? d.tags : []).filter((t: any) => !toRemove.has(t));
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
    } catch (error: any) {
      const statusCode = error?.statusCode || 500;
      if (statusCode >= 500) captureException(error, { endpoint: "records/bulk", reqId: req.id });
      logger.error({ err: error }, "bulk operation failed");
      return send(res, statusCode, { ok: false, error: error?.message || "bulk_failed" }), true;
    }
  }

  return false; // not handled
}
