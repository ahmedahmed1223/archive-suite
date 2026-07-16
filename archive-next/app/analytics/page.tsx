"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";
import AppShell from "@/components/AppShell";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { redactAdminSecrets } from "@/lib/admin-action-summary";
import "./analytics.css";

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

const chartColors = [
  "var(--color-brand-primary)",
  "var(--color-brand-indigo)",
  "var(--color-brand-gold)",
  "var(--color-accent-rose)",
  "var(--color-status-success)",
  "var(--color-status-warning)"
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
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const recordsQuery = useQuery({
    queryKey: ["analytics-records"],
    queryFn: async (): Promise<ArchiveRecord[]> => {
      const response = await api.search({ q: "", limit: 500 });
      if (!response.ok) {
        throw new Error(response.error || "تعذر تحميل بيانات التحليلات.");
      }

      return response.records;
    }
  });
  const records = recordsQuery.data || [];
  const isLoading = recordsQuery.isLoading;
  const loadError = recordsQuery.error instanceof Error ? recordsQuery.error.message : null;

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

  const typeChartData = useMemo(
    () => Object.entries(analytics.countByType).map(([name, value]) => ({ name, value })),
    [analytics.countByType]
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
    <AppShell subtitle="تحليلات الأرشيف" navLabel="التحليلات" contentClassName="observability-content" tipsPage="analytics">
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
            <button className="button button-secondary" type="button" onClick={() => void recordsQuery.refetch()} disabled={recordsQuery.isFetching}>
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
          <p>{redactAdminSecrets(loadError)} — تحقق من الاتصال ثم أعد المحاولة.</p>
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
            <section className="panel analytics-chart analytics-recharts-panel" aria-label="النمو الشهري">
              <div className="panel-title-row">
                <div>
                  <h2>النمو الشهري</h2>
                  <p>آخر 12 شهرًا لديها تاريخ إنشاء أو تحديث واضح.</p>
                </div>
                <span className="badge">{analytics.monthlyGrowth.length} أشهر</span>
              </div>
              <div className="analytics-recharts" role="img" aria-label="رسم بياني للنمو الشهري">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.monthlyGrowth} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border-secondary)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--color-text-tertiary)" tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-text-tertiary)" tickLine={false} axisLine={false} width={34} />
                    <RechartsTooltip
                      cursor={{ fill: "color-mix(in srgb, var(--color-brand-primary) 10%, transparent)" }}
                      contentStyle={{
                        background: "var(--color-bg-secondary)",
                        border: "1px solid var(--color-border-secondary)",
                        borderRadius: "var(--radius-lg)",
                        color: "var(--color-text-primary)"
                      }}
                    />
                    <Bar dataKey="count" name="العناصر" fill="var(--color-brand-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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

          {typeChartData.length > 0 ? (
            <section className="panel analytics-chart analytics-recharts-panel" aria-label="توزيع الأنواع البياني">
              <div className="panel-title-row">
                <div>
                  <h2>خريطة الأنواع</h2>
                  <p>قراءة سريعة لحجم كل نوع داخل نطاق التحليل.</p>
                </div>
                <span className="badge">{typeChartData.length} أنواع</span>
              </div>
              <div className="analytics-recharts" role="img" aria-label="رسم دائري لتوزيع الأنواع">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="48%"
                      outerRadius="74%"
                      paddingAngle={3}
                    >
                      {typeChartData.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip
                      contentStyle={{
                        background: "var(--color-bg-secondary)",
                        border: "1px solid var(--color-border-secondary)",
                        borderRadius: "var(--radius-lg)",
                        color: "var(--color-text-primary)"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

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
