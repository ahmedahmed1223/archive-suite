"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import AppHeader from "@/components/AppHeader";

interface AnalyticsData {
  totalCount: number;
  countByType: Record<string, number>;
  countByStatus: Record<string, number>;
  monthlyGrowth: Array<{ month: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  taggedCount: number;
  taggedPct: number;
}

function calculateAnalytics(records: ArchiveRecord[], daysAgo?: number): AnalyticsData {
  const now = Date.now();
  const cutoff = daysAgo ? now - daysAgo * 86400000 : 0;

  const filtered = records.filter((r) => {
    const ts = r.createdAt || r.updatedAt || "";
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

export default function AnalyticsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"30d" | "90d" | "1y" | "all">("all");

  const daysAgo = useMemo(() => {
    switch (timeRange) {
      case "30d": return 30;
      case "90d": return 90;
      case "1y": return 365;
      default: return undefined;
    }
  }, [timeRange]);

  const analytics = useMemo(() => calculateAnalytics(records, daysAgo), [records, daysAgo]);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    const response = await api.search({ q: "", limit: 500 });
    if (response.ok) {
      setRecords(response.records);
    }
    setIsLoading(false);
  }, [api]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const maxMonthCount = useMemo(
    () => Math.max(1, ...analytics.monthlyGrowth.map((m) => m.count)),
    [analytics.monthlyGrowth]
  );

  const exportCsv = () => {
    const rows = [
      ["id", "title", "type", "createdAt", "updatedAt", "tags"].join(","),
      ...records.map((r) =>
        [
          r.id,
          `"${(r.title || "").replace(/"/g, '""')}"`,
          r.type || "",
          r.createdAt || "",
          r.updatedAt || "",
          `"${(r.tags || []).join("|")}"`
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `archive-analytics-${timeRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isEmpty = analytics.totalCount === 0;

  return (
    <main className="shell">
      <AppHeader subtitle="تحليلات الأرشيف" />

      <section className="content" aria-label="تحليلات">
        <div className="hero">
          <h1>تحليلات الأرشيف</h1>
          <p>
            رؤية شاملة عن نمو الأرشيف وصحته: العناصر الموسومة، النمو الشهري، والوسوم الشائعة.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.5rem", borderRadius: "0.75rem", border: "1px solid var(--va-border-soft)", backgroundColor: "var(--va-surface-2)", padding: "0.25rem" }}>
            {(["30d", "90d", "1y", "all"] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: "500",
                  border: "none",
                  backgroundColor: timeRange === range ? "var(--va-accent)" : "transparent",
                  color: timeRange === range ? "white" : "var(--va-text-muted)",
                  cursor: "pointer",
                  transition: "all 200ms"
                }}
              >
                {range === "30d" ? "30 يوم" : range === "90d" ? "90 يوم" : range === "1y" ? "سنة" : "الكل"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              borderRadius: "0.75rem",
              border: "1px solid var(--va-border-soft)",
              backgroundColor: "var(--va-surface)",
              padding: "0.375rem 0.75rem",
              fontSize: "0.75rem",
              color: "var(--va-text-2)",
              cursor: "pointer",
              transition: "all 200ms"
            }}
          >
            ⬇️ تصدير CSV
          </button>
        </div>

        {isLoading && (
          <div className="panel panel-compact" role="status" aria-live="polite">
            <p className="form-status">جار تحميل البيانات...</p>
          </div>
        )}

        {isEmpty ? (
          <div className="empty-state">
            <strong>لا بيانات للتحليل</strong>
            <p className="helper-text">أضف عناصر إلى الأرشيف لتظهر هنا إحصائيات الأداء.</p>
          </div>
        ) : (
          <>
            {/* Metrics Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
              <div className="panel panel-compact" style={{ textAlign: "right" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.5rem" }}>
                  إجمالي العناصر
                </p>
                <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--va-text)", fontFamily: "var(--va-font-mono)" }}>
                  {analytics.totalCount}
                </p>
              </div>
              <div className="panel panel-compact" style={{ textAlign: "right" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.5rem" }}>
                  موسومة
                </p>
                <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--va-text)", fontFamily: "var(--va-font-mono)" }}>
                  {analytics.taggedPct}%
                </p>
                <p style={{ fontSize: "0.625rem", color: "var(--va-text-muted)" }}>
                  {analytics.taggedCount} عنصر
                </p>
              </div>
              <div className="panel panel-compact" style={{ textAlign: "right" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.5rem" }}>
                  أنواع
                </p>
                <p style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--va-text)", fontFamily: "var(--va-font-mono)" }}>
                  {Object.keys(analytics.countByType).length}
                </p>
              </div>
            </div>

            {/* Monthly Growth Chart */}
            {analytics.monthlyGrowth.length > 0 && (
              <div className="panel panel-compact" style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem", color: "var(--va-text)" }}>
                  النمو الشهري ({analytics.totalCount})
                </h2>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "0.375rem",
                    minHeight: "10rem",
                    overflow: "auto",
                    paddingBottom: "0.5rem"
                  }}
                  role="img"
                  aria-label="رسم بياني للنمو الشهري"
                >
                  {analytics.monthlyGrowth.map((bucket) => {
                    const heightPct = maxMonthCount ? Math.max(4, Math.round((bucket.count / maxMonthCount) * 100)) : 0;
                    return (
                      <div
                        key={bucket.month}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.25rem",
                          minWidth: "2.25rem",
                          flexShrink: 0
                        }}
                        title={`${bucket.month} — ${bucket.count}`}
                      >
                        <p style={{ fontSize: "0.625rem", fontWeight: "500", color: "var(--va-text-2)", fontFamily: "var(--va-font-mono)" }}>
                          {bucket.count}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column-reverse",
                            width: "1.75rem",
                            overflow: "hidden",
                            borderRadius: "var(--va-radius-sm)",
                            minHeight: "0.5rem",
                            backgroundColor: "var(--va-surface-2)"
                          }}
                        >
                          <div
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor: "#10b981",
                              flexGrow: 1
                            }}
                          />
                        </div>
                        <p style={{ fontSize: "0.5625rem", color: "var(--va-text-muted)", fontFamily: "var(--va-font-mono)" }}>
                          {bucket.month}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Types */}
            {Object.keys(analytics.countByType).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "2rem" }}>
                {Object.entries(analytics.countByType).map(([type, count]) => (
                  <span key={type} className="badge" style={{ fontSize: "0.75rem" }}>
                    {type} ({count})
                  </span>
                ))}
              </div>
            )}

            {/* Top Tags */}
            {analytics.topTags.length > 0 && (
              <div className="panel panel-compact">
                <h2 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "1rem", color: "var(--va-text)" }}>
                  أكثر الوسوم ({analytics.topTags.length})
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {analytics.topTags.map(({ tag, count }) => (
                    <div
                      key={tag}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        borderRadius: "var(--va-radius-md)",
                        border: "1px solid var(--va-border-soft)",
                        backgroundColor: "var(--va-surface-2)",
                        padding: "0.75rem",
                        fontSize: "0.875rem"
                      }}
                    >
                      <span style={{ color: "var(--va-text-2)", textAlign: "right", flex: 1 }} dir="auto">
                        {tag}
                      </span>
                      <span style={{ color: "var(--va-text-muted)", fontFamily: "var(--va-font-mono)", fontSize: "0.75rem", fontWeight: "500" }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
