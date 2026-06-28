// §1738 — Pure model for AI-generated item summaries. No side effects.

export type ItemSummaryStatus = "pending" | "done" | "error" | string;

export interface ItemSummary {
  id: string;
  itemId: string;
  shortSummary: string;
  keyPoints: unknown[];
  detailedSummary: string;
  language: string;
  model: string;
  status: ItemSummaryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ItemSummaryInput {
  id?: string;
  itemId?: string;
  shortSummary?: string;
  keyPoints?: unknown[] | null;
  detailedSummary?: string;
  language?: string;
  model?: string;
  status?: ItemSummaryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArchiveItemLike {
  title?: string;
  notes?: string;
  transcript?: { text?: string } | string | null;
}

const MAX_TEXT_LENGTH = 4000;

/**
 * Normalize a summary object with defaults.
 */
export function createItemSummary(partial: ItemSummaryInput = {}): ItemSummary {
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
 */
export function hasValidSummary(summary: ItemSummary | null | undefined): boolean {
  if (!summary) return false;
  return summary.status === "done" && summary.shortSummary.length > 0;
}

/**
 * Returns an Arabic label for the summary status.
 */
export function describeStatus(summary: Pick<ItemSummary, "status"> | null | undefined): string {
  if (!summary) return "غير متاح";
  switch (summary.status) {
    case "pending":
      return "جاري...";
    case "done":
      return "مكتمل";
    case "error":
      return "خطأ";
    default:
      return "غير متاح";
  }
}

/**
 * Extracts text suitable for summarization from an archive item.
 * Combines title, notes, and transcript text, limited to 4000 chars.
 */
export function extractTextForSummary(item: ArchiveItemLike | null | undefined): string {
  if (!item) return "";
  const parts: string[] = [];
  if (item.title) parts.push(item.title.trim());
  if (item.notes) parts.push(item.notes.trim());
  const transcriptText = typeof item.transcript === "string" ? item.transcript : item.transcript?.text || "";
  if (transcriptText && typeof transcriptText === "string") {
    parts.push(transcriptText.trim());
  }
  const combined = parts.filter(Boolean).join("\n\n");
  return combined.slice(0, MAX_TEXT_LENGTH);
}
