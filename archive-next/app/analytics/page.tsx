"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import AppShell from "@/components/AppShell";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";

type TimeRange = "30d" | "90d" | "1y" | "all";

interface AnalyticsData {
  totalCount: number;
  countByType: Record<string, number>;
  countByStatus: Record<string, number>;
  monthlyGrowth: Array<{ month: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  taggedCount: number;
  taggedPct: number;
}

const rangeOptions: Array<DataViewOption<TimeRange>> = [
  { value: "30d", label: "30 يوم" },
  { value: "90d", label: "90 يوم" },
  { value: "1y", label: "سنة" },
  { value: "all", label: "الكل" }
];

function calculateAnalytics(records: ArchiveRecord[], daysAgo?: number): AnalyticsData {
  const now = Date.now();
  const cutoff = daysAgo ? now - daysAgo * 86400000 : 0;

  const filtered = records.filter((record) => {
    const ts = record.createdAt || record.updatedAt || "";
    return !ts || new Date(ts).getTime() >= cutoff;
  });

  const countByType: Record<string, number> = {};
  const countByStatus: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  const monthBuckets: Record<string, number> = {};
  let taggedCount = 0;

  filtered.forEach((record) => {
    const type = record.type || "unknown";
    countByType[type] = (countByType[type] || 0) + 1;

    const status = (record.metadata?.status as string) || "active";
    countByStatus[status] = (countByStatus[status] || 0) + 1;

    if (record.tags && record.tags.length > 0) {
      taggedCount++;
      record.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }

    const dateStr = record.createdAt || record.updatedAt || "";
    if (dateStr) {
      const date = new Date(dateStr);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthBuckets[monthKey] = (monthBuckets[monthKey] || 0) + 1;
    }
  });

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const monthlyGrowth = Object.entries(monthBuckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  return {
    totalCount: filtered.length,
    countByType,
    countByStatus,
    monthlyGrowth,
    topTags,
    taggedCount,
    taggedPct: filtered.length > 0 ? Math.round((taggedCount / filtered.length) * 100) : 0
  };
}

function rangeLabel(range: TimeRange) {
  return rangeOptions.find((option) => option.value === range)?.label || "الكل";
}

export default function AnalyticsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  const daysAgo = useMemo(() => {
    switch (timeRange) {
      case "30d":
        return 30;
      case "90d":
        return 90;
      case "1y":
        return 365;
      default:
        return undefined;
    }
  }, [timeRange]);

  const analytics = useMemo(() => calculateAnalytics(records, daysAgo), [records, daysAgo]);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await api.search({ q: "", limit: 500 });
      if (response.ok) {
        setRecords(response.records);
      } else {
        setLoadError(response.error || "تعذر تحميل بيانات التحليلات.");
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "تعذر تحميل بيانات التحليلات.");
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const maxMonthCount = useMemo(
    () => Math.max(1, ...analytics.monthlyGrowth.map((month) => month.count)),
    [analytics.monthlyGrowth]
  );

  const exportCsv = () => {
    const rows = [
      ["id", "title", "type", "createdAt", "updatedAt", "tags"].join(","),
      ...records.map((record) =>
        [
          record.id,
          `"${(record.title || "").replace(/"/g, '""')}"`,
          record.type || "",
          record.createdAt || "",
          record.updatedAt || "",
          `"${(record.tags || []).join("|")}"`
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `masar-analytics-${timeRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isEmpty = analytics.totalCount === 0;

  return (
    <AppShell subtitle="تحليلات الأرشيف" navLabel="التحليلات" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">تحليل تشغيلي</span>}
        title="تحليلات الأرشيف"
        description="مؤشرات نمو الأرشيف، جودة الوسوم، وتوزيع الأنواع والحالات من بيانات البحث الحالية."
        meta={
          <>
            <span className="badge">{rangeLabel(timeRange)}</span>
            <span className="badge">{records.length} عنصر محمل</span>
            <span className="badge">{analytics.taggedPct}% موسومة</span>
          </>
        }
        actions={
          <>
            <button className="button button-secondary" type="button" onClick={() => void loadRecords()} disabled={isLoading}>
              تحديث
            </button>
            <button className="button button-primary" type="button" onClick={exportCsv} disabled={records.length === 0}>
              تصدير CSV
            </button>
          </>
        }
      >
        <DataViewSwitcher value={timeRange} options={rangeOptions} onChange={setTimeRange} label="نطاق التحليل" />
      </PageToolbar>

      {isLoading ? (
        <section className="state-banner" role="status" aria-live="polite">
          <strong>جار تحميل بيانات التحليل</strong>
          <p>يتم جلب آخر 500 سجل من عقد البحث الحالي.</p>
        </section>
      ) : null}

      {loadError ? (
        <section className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل التحليلات</strong>
          <p>{loadError}</p>
        </section>
      ) : null}

      {isEmpty && !isLoading ? (
        <EmptyState
          title="لا بيانات للتحليل"
          description="أضف عناصر إلى الأرشيف أو وسع نطاق التحليل لتظهر مؤشرات الأداء هنا."
        />
      ) : (
        <>
          <div className="analytics-metric-grid">
            <article className="health-metric" data-tone="accent">
              <div className="health-metric__body">
                <span>إجمالي العناصر</span>
                <strong>{analytics.totalCount}</strong>
              </div>
            </article>
            <article className="health-metric" data-tone="success">
              <div className="health-metric__body">
                <span>العناصر الموسومة</span>
                <strong>{analytics.taggedPct}%</strong>
                <small>{analytics.taggedCount} عنصر</small>
              </div>
            </article>
            <article className="health-metric">
              <div className="health-metric__body">
                <span>عدد الأنواع</span>
                <strong>{Object.keys(analytics.countByType).length}</strong>
              </div>
            </article>
            <article className="health-metric">
              <div className="health-metric__body">
                <span>عدد الحالات</span>
                <strong>{Object.keys(analytics.countByStatus).length}</strong>
              </div>
            </article>
          </div>

          {analytics.monthlyGrowth.length > 0 ? (
            <section className="panel analytics-chart" aria-label="النمو الشهري">
              <div className="panel-title-row">
                <div>
                  <h2>النمو الشهري</h2>
                  <p>آخر 12 شهرًا لديها تاريخ إنشاء أو تحديث واضح.</p>
                </div>
                <span className="badge">{analytics.monthlyGrowth.length} أشهر</span>
              </div>
              <div className="analytics-bar-list" role="img" aria-label="رسم بياني للنمو الشهري">
                {analytics.monthlyGrowth.map((bucket) => {
                  const heightPct = Math.max(4, Math.round((bucket.count / maxMonthCount) * 100));
                  return (
                    <div className="analytics-bar-item" key={bucket.month} title={`${bucket.month} - ${bucket.count}`}>
                      <span className="analytics-bar-value">{bucket.count}</span>
                      <div className="analytics-bar-track">
                        <span className="analytics-bar-fill" style={{ blockSize: `${heightPct}%` }} />
                      </div>
                      <span className="analytics-bar-label">{bucket.month}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="analytics-columns">
            <section className="panel">
              <div className="panel-title-row">
                <div>
                  <h2>توزيع الأنواع</h2>
                  <p>عدد العناصر حسب نوع المحتوى.</p>
                </div>
              </div>
              <div className="analytics-chip-list">
                {Object.entries(analytics.countByType).map(([type, count]) => (
                  <span key={type} className="badge">
                    {type} ({count})
                  </span>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-title-row">
                <div>
                  <h2>الحالات</h2>
                  <p>قراءة أولية من `metadata.status` لكل سجل.</p>
                </div>
              </div>
              <div className="analytics-chip-list">
                {Object.entries(analytics.countByStatus).map(([status, count]) => (
                  <span key={status} className="badge">
                    {status} ({count})
                  </span>
                ))}
              </div>
            </section>
          </div>

          {analytics.topTags.length > 0 ? (
            <section className="panel">
              <div className="panel-title-row">
                <div>
                  <h2>أكثر الوسوم</h2>
                  <p>أعلى الوسوم تكرارًا داخل نطاق التحليل الحالي.</p>
                </div>
                <span className="badge">{analytics.topTags.length} وسوم</span>
              </div>
              <div className="analytics-tag-list">
                {analytics.topTags.map(({ tag, count }) => (
                  <div className="analytics-tag-row" key={tag}>
                    <span dir="auto">{tag}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
