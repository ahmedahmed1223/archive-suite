import { ACTIONS, canPerform } from "../users/permissions.js";

export type AuditLogLike = {
  id?: string;
  eventType?: string;
  targetType?: string;
  targetId?: string | number;
  userId?: string;
  username?: string;
  details?: { text?: string; deletedAt?: string | null };
  timestamp?: string;
  createdAt?: string;
};

export function getItemComments(auditLogs: unknown[] = [], itemId = "") {
  const target = String(itemId || "");
  const logs = Array.isArray(auditLogs) ? (auditLogs as AuditLogLike[]) : [];
  return logs
    .filter((log) => Boolean(
      log &&
      log.eventType === "comment.create" &&
      log.targetType === "video" &&
      String(log.targetId || "") === target &&
      !log.details?.deletedAt
    ))
    .map((log) => ({
      id: log.id,
      itemId: log.targetId,
      userId: log.userId || "",
      author: log.username || "غير معروف",
      text: String(log.details?.text || ""),
      createdAt: log.timestamp || log.createdAt || "",
      raw: log
    }))
    .filter((comment) => comment.text.trim())
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
}

export function canDeleteComment(comment: { userId?: string } | null | undefined, user: { isActive?: boolean; id?: string } | null | undefined) {
  if (!comment || !user || user.isActive === false) return false;
  if (comment.userId && comment.userId === user.id) return true;
  return canPerform(user, ACTIONS.COMMENT_DELETE);
}

export function extractMentionUsernames(text = "") {
  const seen = new Set<string>();
  const usernames: string[] = [];
  const source = String(text || "");
  const pattern = /(^|[\s([،,]|و)@([A-Za-z0-9_.-]{2,40})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const username = match[2];
    const key = username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    usernames.push(username);
  }
  return usernames;
}
