/**
 * V1.5 Task 7: media processing/export rows for the work inbox.
 * Pure derivation from API payloads — permission filtering happens on the
 * server; here we only shape rows and pick the safe affordances to render.
 */

export type MediaWorkSource = "processing" | "export";

export type MediaWorkItem = {
  id: string;
  source: MediaWorkSource;
  /** Server-reported operation status. */
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  label: string;
  /** Server-built safe href — the client never assembles one from raw data. */
  href?: string;
  /** Actions the authenticated actor may take (server-filtered). */
  canRetry: boolean;
  canCancel: boolean;
};

/** A failed operation is never "done": it stays actionable until retried or dismissed server-side. */
export function isMediaWorkBlocked(item: Pick<MediaWorkItem, "status">): boolean {
  return item.status === "failed";
}

export function deriveMediaWorkActions(item: MediaWorkItem): Array<"retry" | "cancel" | "open"> {
  const actions: Array<"retry" | "cancel" | "open"> = [];
  if (item.status === "failed" && item.canRetry) actions.push("retry");
  if ((item.status === "queued" || item.status === "processing") && item.canCancel) {
    actions.push("cancel");
  }
  if (item.href) actions.push("open");
  return actions;
}

/** Group label for the inbox: active work, finished work, or failures needing attention. */
export function mediaWorkGroupLabel(status: MediaWorkItem["status"]): string {
  switch (status) {
    case "queued":
    case "processing":
      return "قيد المعالجة";
    case "completed":
      return "مكتملة";
    case "failed":
      return "فشل يحتاج انتباهك";
    case "cancelled":
      return "ملغاة";
  }
}
