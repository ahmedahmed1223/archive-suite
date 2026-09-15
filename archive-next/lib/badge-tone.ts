import type { ArchiveRecord } from "@/lib/archive-api";
import type { RecordStatusKind } from "@/lib/record-status";

/**
 * V2-DESIGN-002: the single status -> tone mapping for the whole app.
 * Status badges used to render neutral grey everywhere, so a list of records
 * could not be scanned for state. The tone classes (`badge-success` etc.)
 * already existed in the stylesheet -- this maps our domain statuses onto
 * them once, instead of each screen inlining its own colours.
 * ponytail: a lookup table per status union, no component and no new classes.
 */
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  neutral: ""
};

/** Full `class` value for a toned badge. Neutral stays the plain grey badge. */
export function badgeClass(tone: BadgeTone): string {
  return `badge ${BADGE_TONE_CLASS[tone]}`.trim();
}

type DescriptorStatus = NonNullable<ArchiveRecord["descriptorCompletion"]>["status"];
type MediaSummary = NonNullable<ArchiveRecord["mediaSummary"]>;

const RECORD_STATUS_TONE: Record<RecordStatusKind, BadgeTone> = {
  ready: "success",
  archived: "info",
  review: "info",
  incomplete: "warning",
  draft: "warning"
};

const DESCRIBE_TONE: Record<DescriptorStatus, BadgeTone> = {
  green: "success",
  yellow: "warning",
  red: "danger"
};

const PROXY_TONE: Record<MediaSummary["proxyStatus"], BadgeTone> = {
  ready: "success",
  processing: "info",
  pending: "info",
  failed: "danger",
  missing: "neutral"
};

const INSPECTION_TONE: Record<MediaSummary["inspectionStatus"], BadgeTone> = {
  passed: "success",
  warning: "warning",
  failed: "danger",
  waived: "info",
  pending: "info",
  missing: "neutral"
};

export function recordStatusTone(kind: RecordStatusKind): BadgeTone {
  return RECORD_STATUS_TONE[kind];
}

export function describeCompletionTone(status: DescriptorStatus): BadgeTone {
  return DESCRIBE_TONE[status];
}

export function proxyStatusTone(status: MediaSummary["proxyStatus"]): BadgeTone {
  return PROXY_TONE[status];
}

export function inspectionStatusTone(status: MediaSummary["inspectionStatus"]): BadgeTone {
  return INSPECTION_TONE[status];
}
