// ponytail: builds a draft-creation payload from an existing record (V1-831), using the
// existing POST /records endpoint — no new API, no files/share links/rights copied (that
// endpoint never accepts them). Source is recorded in metadata.duplicatedFrom for audit.
import type { ArchiveRecord, CreateRecordPayload } from "@/lib/archive-api";

export function buildDuplicateDraftPayload(record: ArchiveRecord): CreateRecordPayload {
  return {
    title: `نسخة من ${record.title}`,
    description: record.description ?? "",
    type: record.type ?? "",
    tags: [...(record.tags ?? [])],
    metadata: {
      ...(record.metadata ?? {}),
      duplicatedFrom: record.id
    }
  };
}
