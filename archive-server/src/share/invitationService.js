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

async function persistInvitation(storage, invitation) {
  if (!storage || typeof storage.put !== "function") return false;
  await storage.put("share_invitations", invitation);
  return true;
}

export function createShareInvitationService({
  resolvedShareSecret,
  defaultExpiryDays = 30,
  sendMail,
  resolveStorage
} = {}) {
  if (!resolvedShareSecret) {
    throw new Error("Share invitations require a share secret.");
  }

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
            <div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;line-height:1.7;">
              <h2 style="color:#059669;">دعوة مشاركة</h2>
              <p>شارك معك <strong>${escapeHtml(sender?.username || "مستخدم")}</strong> محتوى من Archive Suite.</p>
              ${invitation.title ? `<p><strong>${escapeHtml(invitation.title)}</strong></p>` : ""}
              ${invitation.message ? `<p>${escapeHtml(invitation.message)}</p>` : ""}
              <a href="${escapeHtml(shareUrl)}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">فتح المشاركة</a>
              ${invitation.passwordProtected ? `<p style="color:#92400e;font-size:13px;margin-top:14px;">هذا الرابط يتطلب كلمة مرور أرسلها لك صاحب الدعوة.</p>` : ""}
            </div>
          `
        }) || { sent: false };
        invitation.status = emailStatus.sent ? "sent" : "queued";
        invitation.emailSentAt = emailStatus.sent ? new Date().toISOString() : "";
      }

      try {
        const storage = typeof resolveStorage === "function" ? resolveStorage() : null;
        invitation.persisted = await persistInvitation(storage, invitation);
      } catch {
        invitation.persisted = false;
      }

      return { invitation, token, path: sharePath, url: shareUrl, emailStatus };
    }
  };
}
