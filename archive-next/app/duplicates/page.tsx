"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import ChangeImpactPreview from "@/components/ChangeImpactPreview";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { buildChangeImpact } from "@/lib/change-impact";
import { formatDate, normalizeText } from "@/lib/record-utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface DuplicateGroup {
  key: string;
  reason: string;
  records: ArchiveRecord[];
}

type RecordsState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[] }
  | { status: "error"; message: string };

function checksumKey(record: ArchiveRecord) {
  const checksum = record.checksum || record.metadata?.checksum || record.metadata?.sha256;
  return typeof checksum === "string" && checksum.trim() ? `checksum:${checksum.trim()}` : "";
}

function titleKey(record: ArchiveRecord) {
  const title = normalizeText(record.title);
  return title.length > 3 ? `title:${title}` : "";
}

export default function DuplicatesPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.duplicates;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [recordsState, setRecordsState] = useState<RecordsState>({ status: "loading" });
  const [mode, setMode] = useState<"checksum" | "title">("checksum");

  async function loadRecords() {
    setRecordsState({ status: "loading" });
    const response = await api.search({ limit: 1000 });
    setRecordsState(response.ok
      ? { status: "ready", records: response.records }
      : { status: "error", message: response.error || copy.loadError });
  }

  useEffect(() => {
    void loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadRecords is redefined every render; api is the only stable dependency and is already listed
  }, [api]);

  const records = useMemo(() => (recordsState.status === "ready" ? recordsState.records : []), [recordsState]);

  const groups = useMemo<DuplicateGroup[]>(() => {
    const buckets = new Map<string, ArchiveRecord[]>();
    records.forEach((record) => {
      const key = mode === "checksum" ? checksumKey(record) : titleKey(record);
      if (!key) return;
      buckets.set(key, [...(buckets.get(key) || []), record]);
    });
    return Array.from(buckets.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({
        key,
        reason: key.startsWith("checksum:") ? copy.checksumReason : copy.titleReason,
        records: items
      }))
      .sort((a, b) => b.records.length - a.records.length);
  }, [copy.checksumReason, copy.titleReason, mode, records]);

  return (
    <AppShell subtitle={t.pageTitles.duplicates} contentClassName="local-list-content" tipsPage="duplicates">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={(
          <>
            <span className="badge">{groups.length} {copy.groups}</span>
            <span className="badge">{records.length} {copy.recordsChecked}</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/archive">{copy.openArchive}</a>}
      >
        <div className="archive-toolbar-row">
          <button className="badge" data-active={mode === "checksum" ? "true" : "false"} type="button" onClick={() => setMode("checksum")}>{copy.byChecksum}</button>
          <button className="badge" data-active={mode === "title" ? "true" : "false"} type="button" onClick={() => setMode("title")}>{copy.byTitle}</button>
        </div>
      </PageToolbar>

      {recordsState.status === "loading" ? (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">{copy.loading}</p>
        </div>
      ) : null}

      {recordsState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.error}</strong>
          <span className="helper-text">{recordsState.message}</span>
          <div><button className="button button-secondary button-sm" type="button" onClick={() => void loadRecords()}>{copy.retry}</button></div>
        </div>
      ) : null}

      {recordsState.status === "ready" && groups.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : (
        <section className="stack" aria-label={copy.groupsLabel}>
          {groups.map((group) => (
            <article className="panel" key={group.key}>
              <div className="panel-title-row">
                <div>
                  <h2>{group.reason}</h2>
                  <p className="mono-text wrap-anywhere" dir="ltr">{group.key}</p>
                </div>
                <span className="badge badge-warning">{group.records.length} {copy.items}</span>
              </div>
              <div className="analytics-tag-list">
                {group.records.map((record) => (
                  <div className="analytics-tag-row" key={record.id}>
                    <span>
                      <strong>{record.title || record.id}</strong>
                      <small className="helper-text"> · {record.type || copy.unspecified} · {locale === "en" ? new Date(record.updatedAt || record.createdAt || "").toLocaleDateString("en-US") : formatDate(record.updatedAt || record.createdAt)}</small>
                    </span>
                    <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(record.id)}`}>{copy.open}</a>
                  </div>
                ))}
              </div>
              <ChangeImpactPreview impact={buildChangeImpact({ action: "merge", entity: copy.impactEntity, affectedCount: group.records.length })} />
              <p className="helper-text">{copy.preview}</p>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
