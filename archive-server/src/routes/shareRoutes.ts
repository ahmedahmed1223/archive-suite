// Share routes — create share link, invitations, revoke, public read,
// share-access capabilities and comments.
// Extracted from api/server.js. No business logic changed.

import { mintShareToken, readShareTokenPayload } from "../share/token.js";
import { filterSnapshotForShare } from "../share/scope.js";
import { notifyRecordShared } from "../notifications/notificationService.js";
import { sendPushToUser } from "../notifications/webPushService.js";
import { verifyJwt } from "../auth/jwt.js";

function requestOrigin(req: any): string {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim() || "http";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

/**
 * Handles all /api/share* and /api/share-access* routes.
 * Returns true if the request was handled.
 */
export async function handleShareRoute({
  req,
  res,
  url,
  requestUrl,
  send,
  overLimit,
  readJsonBody,
  requireAuth,
  requireAdmin,
  resolveStorage,
  resolvedShareSecret,
  resolvedAuthSecret,
  shareExpiryDays,
  sharePermissionSvc,
  shareInvitationSvc,
  prisma,
  notificationSendMail,
  bearerToken,
}: any): Promise<boolean> {
  // POST /api/share — mint a share link
  if (req.method === "POST" && url.split("?")[0] === "/api/share") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAuth(req, res)) return true;
    try {
      const body = await readJsonBody(req);
      const expiresInDays = Object.hasOwn(body || {}, "expiresInDays")
        ? Number(body.expiresInDays)
        : shareExpiryDays;
      const title = body?.title || body?.scope?.label || "";
      const token = mintShareToken({
        scope: body?.scope,
        secret: resolvedShareSecret,
        expiresInDays,
        title,
        password: body?.password,
      });
      const payload = readShareTokenPayload(token, resolvedShareSecret, { password: body?.password });
      const shareUrl = `${requestOrigin(req)}/api/share/${token}`;
      if (body?.sharedWithUserId) {
        const senderClaims = (() => {
          try { return verifyJwt(bearerToken(req), resolvedAuthSecret); } catch { return null; }
        })();
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
      return (
        send(res, 200, {
          ok: true,
          result: {
            token,
            path: `/api/share/${token}`,
            title: payload.title,
            expiresAt: payload.expiresAt,
            jti: payload.jti,
            passwordProtected: payload.passwordProtected,
          },
        }),
        true
      );
    } catch (error: any) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Failed to create share link" }), true;
    }
  }

  // POST /api/share/invitations — email invitation for a scoped share link
  if (req.method === "POST" && url.split("?")[0] === "/api/share/invitations") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAuth(req, res)) return true;
    try {
      const body = await readJsonBody(req);
      const senderClaims = (() => {
        try { return verifyJwt(bearerToken(req), resolvedAuthSecret); } catch { return null; }
      })();
      const result = await shareInvitationSvc.createInvitation({
        email: body?.email,
        scope: body?.scope,
        title: body?.title || body?.scope?.label || "",
        message: body?.message || "",
        password: body?.password || "",
        expiresInDays: Object.hasOwn(body || {}, "expiresInDays")
          ? Number(body.expiresInDays)
          : shareExpiryDays,
        origin: requestOrigin(req),
        sender: senderClaims,
      });
      return send(res, 201, { ok: true, result }), true;
    } catch (error: any) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Failed to create share invitation" }), true;
    }
  }

  // POST /api/share/revoke — revoke a share link by jti (admin/owner only, Postgres only)
  if (req.method === "POST" && url.split("?")[0] === "/api/share/revoke") {
    if (overLimit(res, "rpc", req)) return true;
    if (!requireAdmin(req, res)) return true;
    if (!prisma) {
      return send(res, 501, { ok: false, error: "إلغاء الروابط غير متاح في هذا الإعداد." }), true;
    }
    try {
      const body = await readJsonBody(req);
      const jti = String(body?.jti || "").trim();
      if (!jti) return send(res, 400, { ok: false, error: "jti مطلوب." }), true;
      await prisma.shareRevocation.upsert({ where: { jti }, create: { jti }, update: {} });
      return send(res, 200, { ok: true, result: { revoked: true, jti } }), true;
    } catch (error: any) {
      return send(res, error?.statusCode || 500, { ok: false, error: error?.message || "Failed to revoke share link" }), true;
    }
  }

  // GET /api/share/:token — public read (no auth)
  if (req.method === "GET" && url.split("?")[0].startsWith("/api/share/")) {
    if (overLimit(res, "rpc", req)) return true;
    const token = decodeURIComponent(url.split("?")[0].slice("/api/share/".length));
    try {
      const share = readShareTokenPayload(token, resolvedShareSecret, {
        password: req.headers["x-share-password"],
      });
      if (prisma && share.jti) {
        const revoked = await prisma.shareRevocation.findUnique({ where: { jti: share.jti } });
        if (revoked) return send(res, 401, { ok: false, error: "رابط المشاركة مُلغى." }), true;
      }
      const snapshot = await resolveStorage().snapshot();
      return send(res, 200, { ok: true, result: filterSnapshotForShare(snapshot, share.scope as any, share as any) }), true;
    } catch (error: any) {
      return send(res, error?.statusCode || 404, { ok: false, error: error?.message || "Share link not found" }), true;
    }
  }

  // GET /api/share-access — verify capabilities
  if (req.method === "GET" && url.split("?")[0] === "/api/share-access") {
    if (overLimit(res, "rpc", req)) return true;
    const check = sharePermissionSvc.fromRequest(req, { password: req.headers["x-share-password"] });
    if (!check.ok) return send(res, check.status, { ok: false, error: check.error }), true;
    const caps = sharePermissionSvc.capabilities(check.payload);
    return (
      send(res, 200, {
        ok: true,
        result: { permission: check.payload.scope?.permission || "view", capabilities: caps },
      }),
      true
    );
  }

  // POST /api/share-access/comments — post comment via share link
  if (req.method === "POST" && url.split("?")[0] === "/api/share-access/comments") {
    if (overLimit(res, "rpc", req)) return true;
    const check = sharePermissionSvc.fromRequest(req, { password: req.headers["x-share-password"] });
    if (!check.ok) return send(res, check.status, { ok: false, error: check.error }), true;
    if (!sharePermissionSvc.allows(check.payload, "canComment")) {
      return send(res, 403, { ok: false, error: "رابط المشاركة لا يمنح صلاحية التعليق." }), true;
    }
    try {
      const body = await readJsonBody(req);
      const itemId = String(body?.itemId || "").trim();
      const text = String(body?.text || body?.content || "").trim();
      const authorName = String(body?.authorName || "").trim().slice(0, 80) || "زائر";
      if (!itemId) return send(res, 400, { ok: false, error: "معرّف العنصر مطلوب." }), true;
      if (!text) return send(res, 400, { ok: false, error: "نص التعليق مطلوب." }), true;
      if (!sharePermissionSvc.scopeIncludesItem(check.payload, itemId)) {
        return send(res, 403, { ok: false, error: "العنصر ليس ضمن نطاق هذا الرابط." }), true;
      }
      const comment = {
        id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        itemId,
        text: text.slice(0, 4000),
        authorName,
        authorType: "share_link",
        shareJti: check.payload.jti || "",
        createdAt: new Date().toISOString(),
      };
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
              createdAt: new Date(comment.createdAt),
            },
          });
        } else {
          const storage = resolveStorage();
          await storage.put?.("share_comments", comment);
        }
      } catch { /* no-op: local/SPA backends may not support share_comments */ }
      return send(res, 201, { ok: true, result: comment }), true;
    } catch (err: any) {
      return send(res, 400, { ok: false, error: err?.message || "فشل حفظ التعليق." }), true;
    }
  }

  return false; // not handled
}
