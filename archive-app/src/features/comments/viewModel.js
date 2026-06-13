import { ACTIONS, canPerform } from "../users/permissions.js";

export function getItemComments(auditLogs = [], itemId = "") {
  const target = String(itemId || "");
  return (Array.isArray(auditLogs) ? auditLogs : [])
    .filter((log) => (
      log?.eventType === "comment.create" &&
      log?.targetType === "video" &&
      String(log?.targetId || "") === target &&
      !log?.details?.deletedAt
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

export function canDeleteComment(comment, user) {
  if (!comment || !user || user.isActive === false) return false;
  if (comment.userId && comment.userId === user.id) return true;
  return canPerform(user, ACTIONS.COMMENT_DELETE);
}

export function extractMentionUsernames(text = "") {
  const seen = new Set();
  const usernames = [];
  const source = String(text || "");
  const pattern = /(^|[\s([،,]|و)@([A-Za-z0-9_.-]{2,40})/g;
  let match;
  while ((match = pattern.exec(source))) {
    const username = match[2];
    const key = username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    usernames.push(username);
  }
  return usernames;
}
