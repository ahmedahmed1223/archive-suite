import { randomUUID } from "node:crypto";

import { mintShareToken, readShareTokenPayload } from "./token.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function makeInviteId() {
  try {
    return `share_invite_${randomUUID()}`;
  } catch {
    return `share_invite_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function toNullableDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function persistInvitation({ db, storage, invitation }) {
  if (db?.shareInvitation && typeof db.shareInvitation.create === "function") {
    await db.shareInvitation.create({
      data: {
        id: invitation.id,
        email: invitation.email,
        title: invitation.title,
        message: invitation.message,
        scope: invitation.scope,
        permission: invitation.permission,
        shareJti: invitation.shareJti || null,
        sharePath: invitation.sharePath,
        shareUrl: invitation.shareUrl,
        passwordProtected: invitation.passwordProtected,
        expiresAt: toNullableDate(invitation.expiresAt),
        invitedByUserId: invitation.invitedByUserId || null,
        invitedByUsername: invitation.invitedByUsername || null,
        status: invitation.status,
        emailSentAt: toNullableDate(invitation.emailSentAt),
        createdAt: toNullableDate(invitation.createdAt) || new Date()
      }
    });
    return "prisma";
  }
  if (!storage || typeof storage.put !== "function") return false;
  await storage.put("share_invitations", invitation);
  return "storage";
}

export function createShareInvitationService({
  resolvedShareSecret,
  defaultExpiryDays = 30,
  sendMail,
  resolveStorage,
  db
} = {}) {
  return {
    async createInvitation({
      email,
      scope,
      title = "",
      message = "",
      password = "",
      expiresInDays = defaultExpiryDays,
      origin = "",
      sender = {}
    } = {}) {
      if (!resolvedShareSecret) {
        const error = new Error("Share invitations require a share secret.");
        error.statusCode = 503;
        throw error;
      }
      const normalizedEmail = normalizeEmail(email);
      if (!EMAIL_RE.test(normalizedEmail)) {
        const error = new Error("Valid recipient email is required.");
        error.statusCode = 400;
        throw error;
      }

      const token = mintShareToken({
        scope,
        secret: resolvedShareSecret,
        expiresInDays,
        title,
        password
      });
      const payload = readShareTokenPayload(token, resolvedShareSecret, { password });
      const sharePath = `/api/share/${token}`;
      const shareUrl = `${String(origin || "").replace(/\/$/, "")}${sharePath}`;
      const invitation = {
        id: makeInviteId(),
        email: normalizedEmail,
        title: payload.title || title || "",
        message: String(message || "").trim().slice(0, 1000),
        scope: payload.scope,
        permission: payload.scope?.permission || "view",
        shareJti: payload.jti || "",
        sharePath,
        shareUrl,
        passwordProtected: Boolean(payload.passwordProtected),
        expiresAt: payload.expiresAt || "",
        invitedByUserId: sender?.sub || sender?.id || "",
        invitedByUsername: sender?.username || "",
        status: "created",
        createdAt: new Date().toISOString(),
        emailSentAt: ""
      };

      let emailStatus = { sent: false, skipped: true };
      if (typeof sendMail === "function") {
        emailStatus = await sendMail({
          to: normalizedEmail,
          subject: `دعوة مشاركة — ${invitation.title || "Archive Suite"}`,
          text: [
            `${sender?.username || "مستخدم"} شارك معك محتوى من Archive Suite.`,
            invitation.title ? `العنوان: ${invitation.title}` : "",
            invitation.message ? `رسالة: ${invitation.message}` : "",
            `الرابط: ${shareUrl}`,
            invitation.passwordProtected ? "هذا الرابط يتطلب كلمة مرور أرسلها لك صاحب الدعوة." : ""
          ].filter(Boolean).join("\n\n"),
          html: `
            <div dir="rtl" style="font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;background:#f6f4ee;padding:24px 12px;">
              <div style="max-width:560px;margin:0 auto;background:#fffdf9;border:1px solid rgba(15,23,42,0.10);border-radius:18px;overflow:hidden;">
                <div style="background:#0c1726;padding:18px 24px;">
                  <span style="color:#5eead4;font-size:13px;font-weight:600;letter-spacing:.02em;">Archive Suite</span>
                </div>
                <div style="padding:24px;line-height:1.7;color:#14202e;">
                  <h2 style="color:#0d9488;margin:0 0 12px;font-size:19px;font-weight:600;">دعوة مشاركة</h2>
                  <p style="margin:0 0 12px;">شارك معك <strong>${escapeHtml(sender?.username || "مستخدم")}</strong> محتوى من Archive Suite.</p>
                  ${invitation.title ? `<p style="margin:0 0 6px;font-weight:600;color:#14202e;">${escapeHtml(invitation.title)}</p>` : ""}
                  ${invitation.message ? `<p style="margin:0 0 16px;color:#475569;">${escapeHtml(invitation.message)}</p>` : ""}
                  <a href="${escapeHtml(shareUrl)}" style="display:inline-block;margin-top:8px;padding:11px 22px;background:#0d9488;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:600;">فتح المشاركة</a>
                  ${invitation.passwordProtected ? `<p style="color:#92400e;font-size:13px;margin-top:16px;background:#fbf0db;border-radius:8px;padding:10px 12px;">هذا الرابط يتطلب كلمة مرور أرسلها لك صاحب الدعوة.</p>` : ""}
                </div>
              </div>
            </div>
          `
        }) || { sent: false };
        invitation.status = emailStatus.sent ? "sent" : "queued";
        invitation.emailSentAt = emailStatus.sent ? new Date().toISOString() : "";
      }

      try {
        const storage = typeof resolveStorage === "function" ? resolveStorage() : null;
        invitation.persisted = await persistInvitation({ db, storage, invitation });
      } catch {
        invitation.persisted = false;
      }

      return { invitation, token, path: sharePath, url: shareUrl, emailStatus };
    }
  };
}
