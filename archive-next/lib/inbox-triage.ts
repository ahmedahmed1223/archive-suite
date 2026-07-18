import type { InboxStatus } from "./archive-api";

export type InboxTriageCommand =
  | { type: "move"; offset: -1 | 1 }
  | { type: "status"; status: InboxStatus }
  | { type: "open" };

const statuses: Record<string, InboxStatus> = {
  "1": "new",
  "2": "triage",
  "3": "ready",
  "4": "done",
};

export function triageCommand(key: string, editing = false): InboxTriageCommand | null {
  if (editing) return null;
  if (key === "j" || key === "J" || key === "ArrowDown") return { type: "move", offset: 1 };
  if (key === "k" || key === "K" || key === "ArrowUp") return { type: "move", offset: -1 };
  if (statuses[key]) return { type: "status", status: statuses[key] };
  if (key === "Enter") return { type: "open" };
  return null;
}
