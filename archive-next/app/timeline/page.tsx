"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  createArchiveApiClient,
  type ArchiveRecord,
  type RecordListPayload,
} from "@/lib/archive-api";
import styles from "./timeline.module.css";

// Simple SVG icons as components
function IconCalendar() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
      <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
      <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
      <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <polyline points="12 6 12 12 16 14" strokeWidth="2" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <polyline points="16 12 12 9 9 12" strokeWidth="2" />
    </svg>
  );
}

type Granularity = "day" | "month" | "year";
type GroupBy = "type" | "status";

interface TimelineGroup {
  period: string;
  records: ArchiveRecord[];
}

function parseDate(dateStr: string | undefined): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

function getMonthName(month: number): string {
  const months = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  return months[month] || "";
}

function formatPeriodLabel(date: Date, granularity: Granularity): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  switch (granularity) {
    case "day":
      return `${day} ${getMonthName(month)} ${year}`;
    case "month":
      return `${getMonthName(month)} ${year}`;
    case "year":
      return `${year}`;
    default:
      return "";
  }
}

function getPeriodKey(date: Date, granularity: Granularity): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  switch (granularity) {
    case "day":
      return `${year}-${month}-${day}`;
    case "month":
      return `${year}-${month}`;
    case "year":
      return `${year}`;
    default:
      return "";
  }
}

function groupRecordsByPeriod(
  records: ArchiveRecord[],
  granularity: Granularity
): Map<string, ArchiveRecord[]> {
  const groups = new Map<string, ArchiveRecord[]>();

  records.forEach((record) => {
    const date = parseDate(record.createdAt);
    const key = getPeriodKey(date, granularity);

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(record);
  });

  // Sort by key descending (newest first)
  const sorted = new Map([...groups].sort((a, b) => b[0].localeCompare(a[0])));
  return sorted;
}

interface LoadState {
  status: "loading" | "success" | "error";
  records: ArchiveRecord[];
  error: string | null;
}

export default function TimelinePage() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    records: [],
    error: null,
  });
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [groupBy] = useState<GroupBy>("type");

  const api = useMemo(() => createArchiveApiClient(), []);

  const loadRecords = useCallback(async () => {
    setState({ status: "loading", records: [], error: null });
    try {
      let allRecords: ArchiveRecord[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const response = await api.records({ store: "", cursor, limit: 100 });

        if (!response.ok) {
          setState({ status: "error", records: [], error: response.error });
          return;
        }

        const payload = response as unknown as RecordListPayload;
        allRecords = allRecords.concat(payload.records || []);
        cursor = payload.nextCursor || undefined;
        hasMore = !!cursor;
      }

      setState({ status: "success", records: allRecords, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "خطأ غير معروف";
      setState({
        status: "error",
        records: [],
        error: `فشل تحميل السجلات: ${message}`,
      });
    }
  }, [api]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const groupedRecords = useMemo(() => {
    const groups = groupRecordsByPeriod(state.records, granularity);
    const result: TimelineGroup[] = [];

    groups.forEach((records, key) => {
      const parts = key.split("-");
      const date =
        granularity === "day"
          ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
          : granularity === "month"
            ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1)
            : new Date(parseInt(parts[0]), 0);

      result.push({
        period: formatPeriodLabel(date, granularity),
        records: records.sort(
          (a, b) =>
            parseDate(b.createdAt).getTime() -
            parseDate(a.createdAt).getTime()
        ),
      });
    });

    return result;
  }, [state.records, granularity]);

  const recordCount = state.records.length;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Hero section */}
      <section className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 mt-1 shrink-0" style={{ color: "var(--color-brand-primary)" }}>
            <IconCalendar />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              الخط الزمني
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              اعرض السجلات مرتبة حسب الوقت. غيّر دقة التجميع من يوم إلى شهر أو سنة.
            </p>
          </div>
        </div>
      </section>

      {/* Granularity selector */}
      <div className="panel p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-4 w-4">
            <IconClock />
          </div>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            دقة التجميع
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["day", "month", "year"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                granularity === g
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              aria-pressed={granularity === g}
            >
              {g === "day" ? "يوم" : g === "month" ? "شهر" : "سنة"}
            </button>
          ))}
        </div>
      </div>

      {/* Status messages */}
      {state.status === "loading" && (
        <div className="panel p-4 text-center text-gray-600 dark:text-gray-400">
          <p>جاري تحميل السجلات…</p>
        </div>
      )}

      {state.error && (
        <div
          className="panel p-4 text-sm"
          style={{
            borderLeftColor: "var(--color-status-error)",
            backgroundColor: "color-mix(in oklab, var(--color-status-error) 10%, transparent)",
            color: "var(--color-status-error)",
          }}
          role="alert"
        >
          {state.error}
        </div>
      )}

      {/* Empty state */}
      {state.status === "success" && recordCount === 0 && (
        <div className="panel p-8 text-center">
          <div className="h-12 w-12 mx-auto mb-3 text-gray-400">
            <IconCalendar />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            لا توجد سجلات حتى الآن
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            أضف سجلات إلى الأرشيف لعرضها هنا مرتبة على الخط الزمني.
          </p>
        </div>
      )}

      {/* Timeline groups */}
      {state.status === "success" && recordCount > 0 && (
        <section className="space-y-8">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="panel p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">إجمالي السجلات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {recordCount}
              </p>
            </div>
            <div className="panel p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">الفترات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {groupedRecords.length}
              </p>
            </div>
            <div className="panel p-3 text-center sm:col-start-auto">
              <p className="text-xs text-gray-500 dark:text-gray-400">النطاق</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">
                {granularity === "day" ? "يوم" : granularity === "month" ? "شهر" : "سنة"}
              </p>
            </div>
          </div>

          {/* Timeline sections */}
          <div className={styles.timelineContainer}>
            {groupedRecords.map((group, groupIndex) => (
              <section key={group.period} className={styles.timelineGroup}>
                {/* Timeline node */}
                <div className={styles.timelineNode}>
                  <div
                    className={styles.dot}
                    style={{
                      backgroundColor: "var(--color-brand-primary)",
                    }}
                  />
                  <div className={styles.line} />
                </div>

                {/* Group content */}
                <article className="ml-4 sm:ml-6 pb-4">
                  <header className="mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {group.period}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {group.records.length}{" "}
                      {group.records.length === 1 ? "سجل" : "سجلات"}
                    </p>
                  </header>

                  {/* Record cards */}
                  <div className="space-y-2">
                    {group.records.map((record) => (
                      <Link
                        key={record.id}
                        href={`/archive/${encodeURIComponent(record.id)}`}
                        className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-4 w-4 mt-1 shrink-0 text-gray-400">
                            <IconCheck />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {record.title}
                            </p>
                            {record.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                {record.description}
                              </p>
                            )}
                            {record.type && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {record.type}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </article>
              </section>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
