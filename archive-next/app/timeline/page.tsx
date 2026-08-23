"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import styles from "./timeline.module.css";
import { useLocale } from "@/lib/i18n/LocaleProvider";

function IconCalendar() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
      <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
      <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
      <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <polyline points="16 12 12 9 9 12" strokeWidth="2" />
    </svg>
  );
}

type Granularity = "day" | "month" | "year";

interface TimelineGroup {
  period: string;
  key: string;
  records: ArchiveRecord[];
}

interface LoadState {
  status: "loading" | "success" | "error";
  records: ArchiveRecord[];
  error: string | null;
}

function parseDate(dateStr: string | undefined): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

function formatPeriodLabel(date: Date, granularity: Granularity, months: readonly string[]): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (granularity === "day") return `${day} ${months[month] || ""} ${year}`;
  if (granularity === "month") return `${months[month] || ""} ${year}`;
  return `${year}`;
}

function getPeriodKey(date: Date, granularity: Granularity): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (granularity === "day") return `${year}-${month}-${day}`;
  if (granularity === "month") return `${year}-${month}`;
  return `${year}`;
}

function groupRecordsByPeriod(records: ArchiveRecord[], granularity: Granularity, months: readonly string[]): TimelineGroup[] {
  const groups = new Map<string, ArchiveRecord[]>();

  records.forEach((record) => {
    const date = parseDate(record.createdAt || record.updatedAt);
    const key = getPeriodKey(date, granularity);
    const current = groups.get(key) || [];
    current.push(record);
    groups.set(key, current);
  });

  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, groupRecords]) => {
      const parts = key.split("-").map((part) => Number.parseInt(part, 10));
      const date =
        granularity === "day"
          ? new Date(parts[0], parts[1] - 1, parts[2])
          : granularity === "month"
            ? new Date(parts[0], parts[1] - 1)
            : new Date(parts[0], 0);

      return {
        key,
        period: formatPeriodLabel(date, granularity, months),
        records: groupRecords.sort(
          (a, b) => parseDate(b.createdAt || b.updatedAt).getTime() - parseDate(a.createdAt || a.updatedAt).getTime()
        )
      };
    });
}

export default function TimelinePage() {
  const { t, locale } = useLocale();
  const copy = t.pages.timeline;
  const granularityOptions: Array<DataViewOption<Granularity>> = [{ value: "day", label: copy.day }, { value: "month", label: copy.month }, { value: "year", label: copy.year }];
  const granularityLabel = (value: Granularity) => granularityOptions.find((option) => option.value === value)?.label || copy.month;
  const [state, setState] = useState<LoadState>({
    status: "loading",
    records: [],
    error: null
  });
  const [granularity, setGranularity] = useState<Granularity>("month");

  const api = useMemo(() => createArchiveApiClient(), []);

  const loadRecords = useCallback(async () => {
    setState({ status: "loading", records: [], error: null });
    try {
      let allRecords: ArchiveRecord[] = [];
      let cursor: string | undefined;
      let hasMore = true;
      // V14-AUDIT-014: cap pagination like map.tsx — an unbounded while-loop
      // over a large archive freezes the tab. 25 pages x 100 records.
      const MAX_PAGES = 25;
      let pagesFetched = 0;

      while (hasMore && pagesFetched < MAX_PAGES) {
        const response = await api.records({ store: "", cursor, limit: 100 });

        if (!response.ok) {
          setState({ status: "error", records: [], error: response.error });
          return;
        }

        allRecords = allRecords.concat(response.records || []);
        cursor = response.nextCursor || undefined;
        hasMore = Boolean(cursor);
        pagesFetched += 1;
      }

      setState({ status: "success", records: allRecords, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.unknownError;
      setState({
        status: "error",
        records: [],
        error: copy.loadFailed.replace("{message}", message)
      });
    }
  }, [api, copy]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const groupedRecords = useMemo(
    () => groupRecordsByPeriod(state.records, granularity, copy.months),
    [state.records, granularity, copy.months]
  );

  const recordCount = state.records.length;

  return (
    <AppShell subtitle={t.pageTitles.timeline} navLabel={t.pageTitles.timeline} contentClassName="timeline-content" tipsPage="timeline">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={
          <>
            <span className="badge">{copy.recordCount.replace("{count}", String(recordCount))}</span>
            <span className="badge">{copy.periodCount.replace("{count}", String(groupedRecords.length))}</span>
            <span className="badge">{copy.range.replace("{value}", granularityLabel(granularity))}</span>
          </>
        }
        actions={
          <button className="button button-secondary" type="button" onClick={() => void loadRecords()} disabled={state.status === "loading"}>
            {copy.refresh}
          </button>
        }
      >
        <DataViewSwitcher value={granularity} options={granularityOptions} onChange={setGranularity} label={copy.granularity} />
      </PageToolbar>

      {state.status === "loading" ? (
        <section className="state-banner" role="status" aria-live="polite">
          <strong>{copy.loading}</strong><p>{copy.loadingDescription}</p>
        </section>
      ) : null}

      {state.error ? (
        <section className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadError}</strong>
          <p>{state.error}</p>
        </section>
      ) : null}

      {state.status === "success" && recordCount === 0 ? (
        <EmptyState
          title={copy.noRecords} description={copy.noRecordsDescription} actions={<a className="button button-secondary" href="/archive">{copy.openArchive}</a>}
        />
      ) : null}

      {state.status === "success" && recordCount > 0 ? (
        <>
          <div className="health-metric-grid">
            <article className="health-metric" data-tone="accent">
              <div className="health-metric__icon">
                <IconCalendar />
              </div>
              <div className="health-metric__body">
                <span>{copy.totalRecords}</span>
                <strong>{recordCount}</strong>
              </div>
            </article>
            <article className="health-metric">
              <div className="health-metric__body">
                <span>{copy.periods}</span>
                <strong>{groupedRecords.length}</strong>
              </div>
            </article>
            <article className="health-metric">
              <div className="health-metric__body">
                <span>{copy.displayGranularity}</span>
                <strong>{granularityLabel(granularity)}</strong>
              </div>
            </article>
          </div>

          <section className={styles.timelineContainer} aria-label={copy.groups}>
            {groupedRecords.map((group) => (
              <div key={group.key} className={styles.timelineGroup}>
                <div className={styles.timelineNode} aria-hidden="true">
                  <span className={styles.dot} />
                  <span className={styles.line} />
                </div>

                <article className={styles.groupContent}>
                  <header className={styles.groupHeader}>
                    <div>
                      <h2>{group.period}</h2>
                      <p>{group.records.length} {group.records.length === 1 ? copy.record : copy.records}</p>
                    </div>
                    <span className="badge">{group.key}</span>
                  </header>

                  <div className={styles.recordList}>
                    {group.records.map((record) => (
                      <Link
                        key={record.id}
                        href={`/archive/${encodeURIComponent(record.id)}`}
                        className={styles.recordCard}
                      >
                        <span className={styles.recordIcon}>
                          <IconCheck />
                        </span>
                        <span className={styles.recordBody}>
                          <strong>{record.title || record.id}</strong>
                          {record.description ? <span>{record.description}</span> : null}
                          <span className={styles.recordMeta}>
                            {record.type || copy.untitledType}
                            {record.createdAt ? ` · ${new Date(record.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-SA")}` : ""}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </article>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
