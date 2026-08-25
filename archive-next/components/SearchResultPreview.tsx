"use client";

import Link from "next/link";

export type SearchPreviewRecord = {
  id: string;
  title: string;
  description?: string | null;
  type?: string | null;
};

export function resolveSearchPreviewRecord<T extends SearchPreviewRecord>(records: readonly T[], selectedId: string | null): T | null {
  return records.find((record) => record.id === selectedId) ?? records[0] ?? null;
}

export default function SearchResultPreview({
  records,
  selectedId,
  onSelect,
  onClose,
  previewLabel,
  openLabel,
  closeLabel,
}: Readonly<{
  records: readonly SearchPreviewRecord[];
  selectedId: string | null;
  onSelect(id: string): void;
  onClose?: () => void;
  previewLabel: string;
  openLabel: string;
  closeLabel?: string;
}>) {
  const preview = resolveSearchPreviewRecord(records, selectedId);
  const headingId = "search-result-preview-heading";

  return (
    <section className="search-workspace">
      <div className="search-results-surface" role="listbox" aria-label={previewLabel}>
        {records.map((record) => (
          <button
            key={record.id}
            type="button"
            role="option"
            aria-selected={preview?.id === record.id}
            className="local-list-card"
            onClick={() => onSelect(record.id)}
          >
            <strong>{record.title}</strong>
            {record.type ? <span className="badge">{record.type}</span> : null}
          </button>
        ))}
      </div>
      <aside className="record-preview-rail" role="region" aria-labelledby={headingId} aria-live="polite">
        {onClose && closeLabel ? <button type="button" className="button button-secondary button-sm" onClick={onClose}>{closeLabel}</button> : null}
        {preview ? (
          <>
            <h2 id={headingId}>{previewLabel}</h2>
            <h3>{preview.title}</h3>
            <p>{preview.description || "-"}</p>
            <Link className="button button-primary" href={`/archive/${encodeURIComponent(preview.id)}`}>{openLabel}</Link>
          </>
        ) : <h2 id={headingId}>{previewLabel}</h2>}
      </aside>
    </section>
  );
}
