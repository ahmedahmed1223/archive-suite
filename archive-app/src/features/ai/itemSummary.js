// §1738 — Pure model for AI-generated item summaries. No side effects.

const MAX_TEXT_LENGTH = 4000;

/**
 * Normalize a summary object with defaults.
 * @param {object} partial
 * @returns {object}
 */
export function createItemSummary(partial = {}) {
  const itemId = partial.itemId || "";
  return {
    id: partial.id || (itemId ? `sum_${itemId}` : ""),
    itemId,
    shortSummary: (partial.shortSummary || "").trim(),
    keyPoints: Array.isArray(partial.keyPoints) ? partial.keyPoints : [],
    detailedSummary: (partial.detailedSummary || "").trim(),
    language: partial.language || "ar",
    model: partial.model || "",
    status: partial.status || "pending",
    createdAt: partial.createdAt || new Date().toISOString(),
    updatedAt: partial.updatedAt || new Date().toISOString()
  };
}

/**
 * Returns true when the summary is complete and has a non-empty shortSummary.
 * @param {object|null|undefined} summary
 * @returns {boolean}
 */
export function hasValidSummary(summary) {
  if (!summary) return false;
  return summary.status === "done" && summary.shortSummary.length > 0;
}

/**
 * Returns an Arabic label for the summary status.
 * @param {object|null|undefined} summary
 * @returns {string}
 */
export function describeStatus(summary) {
  if (!summary) return "غير متاح";
  switch (summary.status) {
    case "pending": return "جاري...";
    case "done":    return "مكتمل";
    case "error":   return "خطأ";
    default:        return "غير متاح";
  }
}

/**
 * Extracts text suitable for summarization from an archive item.
 * Combines title, notes, and transcript text, limited to 4000 chars.
 * @param {object} item
 * @returns {string}
 */
export function extractTextForSummary(item) {
  if (!item) return "";
  const parts = [];
  if (item.title) parts.push(item.title.trim());
  if (item.notes) parts.push(item.notes.trim());
  const transcriptText = item.transcript?.text || item.transcript || "";
  if (transcriptText && typeof transcriptText === "string") {
    parts.push(transcriptText.trim());
  }
  const combined = parts.filter(Boolean).join("\n\n");
  return combined.slice(0, MAX_TEXT_LENGTH);
}
