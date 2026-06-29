/**
 * notificationService.ts
 * Sends email notifications for archive events.
 * All sends are fire-and-forget via setImmediate — never block the main request.
 *
 * sendMail is a thin wrapper expected to match the nodemailer transport.sendMail
 * signature: sendMail({ to, subject, text, html }).
 */

import { createLogger } from "../logger.js";

const log = createLogger("notifications");

/** Default prefs used when the table row doesn't exist or Prisma is unavailable. */
const DEFAULT_PREFS = { emailOnShare: true, emailOnUpload: false, emailOnMention: true };

interface NotificationPrefs {
  emailOnShare: boolean;
  emailOnUpload: boolean;
  emailOnMention: boolean;
}

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Retrieve a user's notification preferences, falling back to safe defaults.
 */
async function getPrefs(prisma: any, userId: string): Promise<NotificationPrefs> {
  if (!prisma?.notificationPreference) return { ...DEFAULT_PREFS };
  try {
    const row = await prisma.notificationPreference.findUnique({ where: { userId } });
    return normalizePrefs(row);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function normalizePrefs(row: any): NotificationPrefs {
  if (!row) return { ...DEFAULT_PREFS };
  return {
    emailOnShare: typeof row.emailOnShare === "boolean" ? row.emailOnShare : row.onShare ?? DEFAULT_PREFS.emailOnShare,
    emailOnUpload: typeof row.emailOnUpload === "boolean" ? row.emailOnUpload : row.onUpload ?? DEFAULT_PREFS.emailOnUpload,
    emailOnMention: typeof row.emailOnMention === "boolean" ? row.emailOnMention : row.onMention ?? DEFAULT_PREFS.emailOnMention,
  };
}

/**
 * Notify a user that a record has been shared with them.
 */
export function notifyRecordShared({ prisma, sendMail, sharedWithUserId, sharedByUsername, recordTitle, shareUrl }: {
  prisma: any;
  sendMail: (opts: MailOptions) => Promise<void>;
  sharedWithUserId: string;
  sharedByUsername?: string;
  recordTitle?: string;
  shareUrl?: string;
}): void {
  setImmediate(async () => {
    try {
      if (!sendMail || !sharedWithUserId) return;
      const prefs = await getPrefs(prisma, sharedWithUserId);
      if (!prefs.emailOnShare) return;

      const email = await resolveUserEmail(prisma, sharedWithUserId);
      if (!email) return;

      await sendMail({
        to: email,
        subject: `تمت مشاركة سجل معك — ${recordTitle ?? "سجل جديد"}`,
        text: `شارك معك ${sharedByUsername ?? "مستخدم"} سجلاً: "${recordTitle ?? "سجل جديد"}".\n\nرابط المشاركة: ${shareUrl ?? ""}`,
        html: `
          <div dir="rtl" style="font-family: system-ui, Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <h2 style="color: #059669;">تمت مشاركة سجل معك</h2>
            <p>شارك معك <strong>${escapeHtml(sharedByUsername ?? "مستخدم")}</strong> سجلاً:</p>
            <p style="font-size: 1.1em; font-weight: 600; margin: 12px 0;">${escapeHtml(recordTitle ?? "سجل جديد")}</p>
            ${shareUrl ? `<a href="${escapeHtml(shareUrl)}" style="display:inline-block;margin-top:4px;padding:10px 20px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">فتح السجل</a>` : ""}
            <p style="margin-top:24px;color:#6b7280;font-size:0.85em;">Archive Suite — رسالة تلقائية، لا تردّ عليها مباشرةً.</p>
          </div>
        `,
      });

      log.debug({ to: email, recordTitle }, "notifyRecordShared: sent");
    } catch (err) {
      log.warn({ err: (err as any)?.message }, "notifyRecordShared failed");
    }
  });
}

/**
 * Notify a user that their upload/OCR processing has completed.
 */
export function notifyUploadComplete({ prisma, sendMail, userId, userEmail, recordTitle }: {
  prisma: any;
  sendMail: (opts: MailOptions) => Promise<void>;
  userId: string;
  userEmail?: string | null;
  recordTitle?: string;
}): void {
  setImmediate(async () => {
    try {
      if (!sendMail) return;
      const prefs = await getPrefs(prisma, userId);
      if (!prefs.emailOnUpload) return;

      const email = userEmail || await resolveUserEmail(prisma, userId);
      if (!email) return;

      await sendMail({
        to: email,
        subject: `اكتملت معالجة الملف — ${recordTitle ?? "سجل جديد"}`,
        text: `اكتملت معالجة ملفك: "${recordTitle ?? "سجل جديد"}". يمكنك الآن الاطلاع على السجل ونص OCR.`,
        html: `
          <div dir="rtl" style="font-family: system-ui, Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <h2 style="color: #059669;">اكتملت معالجة الملف</h2>
            <p>اكتملت معالجة ملفك بنجاح:</p>
            <p style="font-size: 1.1em; font-weight: 600; margin: 12px 0;">${escapeHtml(recordTitle ?? "سجل جديد")}</p>
            <p style="color: #6b7280; font-size: 0.9em;">يمكنك الآن الاطلاع على نص OCR والوسوم المقترحة.</p>
            <p style="margin-top:24px;color:#6b7280;font-size:0.85em;">Archive Suite — رسالة تلقائية، لا تردّ عليها مباشرةً.</p>
          </div>
        `,
      });

      log.debug({ to: email, recordTitle }, "notifyUploadComplete: sent");
    } catch (err) {
      log.warn({ err: (err as any)?.message }, "notifyUploadComplete failed");
    }
  });
}

/**
 * Notify a user that they were mentioned in an archive discussion/comment.
 */
export function notifyMention({ prisma, sendMail, mentionedUserId, mentionedByUsername, recordTitle, context, url }: {
  prisma: any;
  sendMail: (opts: MailOptions) => Promise<void>;
  mentionedUserId: string;
  mentionedByUsername?: string;
  recordTitle?: string;
  context?: string;
  url?: string;
}): void {
  setImmediate(async () => {
    try {
      if (!sendMail || !mentionedUserId) return;
      const prefs = await getPrefs(prisma, mentionedUserId);
      if (!prefs.emailOnMention) return;

      const email = await resolveUserEmail(prisma, mentionedUserId);
      if (!email) return;

      await sendMail({
        to: email,
        subject: `تمت الإشارة إليك — ${recordTitle ?? "سجل"}`,
        text: `أشار إليك ${mentionedByUsername ?? "مستخدم"} في "${recordTitle ?? "سجل"}".${context ? `\n\n${context}` : ""}${url ? `\n\nالرابط: ${url}` : ""}`,
        html: `
          <div dir="rtl" style="font-family: system-ui, Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <h2 style="color: #059669;">تمت الإشارة إليك</h2>
            <p>أشار إليك <strong>${escapeHtml(mentionedByUsername ?? "مستخدم")}</strong> في:</p>
            <p style="font-size: 1.1em; font-weight: 600; margin: 12px 0;">${escapeHtml(recordTitle ?? "سجل")}</p>
            ${context ? `<p style="padding:12px;background:#f3f4f6;border-radius:8px;">${escapeHtml(context)}</p>` : ""}
            ${url ? `<a href="${escapeHtml(url)}" style="display:inline-block;margin-top:4px;padding:10px 20px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">فتح السجل</a>` : ""}
            <p style="margin-top:24px;color:#6b7280;font-size:0.85em;">Archive Suite — رسالة تلقائية، لا تردّ عليها مباشرةً.</p>
          </div>
        `,
      });

      log.debug({ to: email, recordTitle }, "notifyMention: sent");
    } catch (err) {
      log.warn({ err: (err as any)?.message }, "notifyMention failed");
    }
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve a user's email from the StorageRow `users` store or typed_users table.
 * Returns null when not found or on error — never throws.
 */
async function resolveUserEmail(prisma: any, userId: string): Promise<string | null> {
  if (!prisma) return null;
  try {
    // Prefer the typed_users table (faster index lookup).
    if (prisma.user) {
      const row = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (row?.email) return row.email;
    }
    // Fallback: generic StorageRow store="users".
    if (prisma.storageRow) {
      const row = await prisma.storageRow.findUnique({ where: { store_uid: { store: "users", uid: userId } } });
      const data = row?.data;
      if (data && typeof data === "object" && (data as any).email) return (data as any).email;
    }
    return null;
  } catch {
    return null;
  }
}

/** Minimal HTML entity escaping to prevent injection in email bodies. */
function escapeHtml(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
