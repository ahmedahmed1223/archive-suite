"use client";

import type { ReactNode } from "react";

export type SearchPreviewRecord = {
  id: string;
  title: string;
  description?: string | null;
};

export function resolveSearchPreviewRecord<T extends SearchPreviewRecord>(records: readonly T[], selectedId: string | null): T | null {
  return records.find((record) => record.id === selectedId) ?? records[0] ?? null;
}

export default function SearchResultPreview<T extends SearchPreviewRecord>({
  records,
  selectedId,
  previewLabel,
  renderPreview,
  empty,
}: Readonly<{
  records: readonly T[];
  selectedId: string | null;
  previewLabel: string;
  renderPreview: (record: T, headingId: string) => ReactNode;
  empty: ReactNode;
}>) {
  const preview = resolveSearchPreviewRecord(records, selectedId);
  const headingId = "search-result-preview-heading";

  return (
    <aside className="record-preview-rail" role="region" aria-label={previewLabel} aria-live="polite">
      {preview ? renderPreview(preview, headingId) : empty}
    </aside>
  );
}
