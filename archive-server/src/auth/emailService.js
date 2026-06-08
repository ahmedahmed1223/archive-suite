/**
 * Email service for password reset and notifications.
 * Uses nodemailer with SMTP (configurable via env vars).
 * Fails silently in dev when SMTP is not configured.
 */
import nodemailer from "nodemailer";
import { createLogger } from "../logger.js";

const log = createLogger("email");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null; // SMTP not configured — emails silently dropped

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

const FROM = process.env.SMTP_FROM || "Archive Suite <noreply@example.com>";

/**
 * Generic sendMail helper.
 * Exported for use by notificationService and any other feature that needs to
 * send a transactional email without going through a dedicated helper function.
 *
 * In dev (no SMTP_HOST) the call is a silent no-op that returns { sent: false, dev: true }.
 *
 * @param {{ to: string, subject: string, text?: string, html?: string }} opts
 * @returns {Promise<{ sent: boolean, dev?: boolean }>}
 */
export async function sendMail({ to, subject, text, html }) {
  const transport = createTransport();
  if (!transport) {
    log.debug({ to, subject }, "SMTP not configured — email dropped (dev).");
    return { sent: false, dev: true };
  }
  await transport.sendMail({ from: FROM, to, subject, text, html });
  return { sent: true };
}

export async function sendPasswordResetEmail({ to, resetUrl, username }) {
  const transport = createTransport();
  if (!transport) {
    // Dev mode: log reset URL when SMTP not configured so developers can use it.
    log.info({ username, resetUrl }, "SMTP not configured — password reset URL logged for dev.");
    return { sent: false, dev: true };
  }

  await transport.sendMail({
    from: FROM,
    to,
    subject: "إعادة تعيين كلمة المرور — Archive Suite",
    text: `مرحباً ${username}،\n\nاضغط على الرابط التالي لإعادة تعيين كلمة المرور:\n${resetUrl}\n\nالرابط صالح لمدة 15 دقيقة.\n\nإذا لم تطلب هذا، تجاهل الرسالة.`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #059669;">إعادة تعيين كلمة المرور</h2>
        <p>مرحباً ${escapeHtml(username)}،</p>
        <p>اضغط على الزر التالي لإعادة تعيين كلمة المرور:</p>
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 24px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
          إعادة تعيين كلمة المرور
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px;">الرابط صالح لمدة 15 دقيقة فقط.</p>
        <p style="color:#888;font-size:12px;">إذا لم تطلب هذا، تجاهل هذه الرسالة.</p>
      </div>
    `,
  });

  return { sent: true };
}
