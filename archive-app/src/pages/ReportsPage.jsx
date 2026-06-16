import {
  useAppStore
} from "../stores/index.js";
import {
  ChartColumn,
  Database,
  Download,
  FileText,
  FileSpreadsheet,
  FolderOpen,
  HardDrive,
  History,
  Users
} from "lucide-react";
import * as React from "react";
import { XLSX } from "../vendor/xlsx.js";

import {
  downloadArchiveBlob
} from "../services/data-portability/index.js";
import { computeCompleteness } from "../features/archive/completeness.js";
import { computeTopTags } from "../features/analytics/topTags.js";
import { InteractiveCharts } from "../components/analytics/InteractiveCharts.jsx";
import {
  FormSection,
  MetricCard,
  MotionPage,
  PageHero,
  UXEmptyState
} from "../components/ui/index.js";
import {
  formatDateTime,
  formatFileSize,
  formatNumber
} from "../utils/formatting.js";

// BarList: chart-style list — uses the shell accent so it follows
// the picker; falls back to an UXEmptyState when no data to plot.
function BarList({ items, maxValue, emptyTitle, emptyHint }) {
  if (!items.length) {
    return (
      <UXEmptyState
        icon={<ChartColumn className="h-7 w-7" aria-hidden="true" />}
        title={emptyTitle}
        description={emptyHint}
        className="bg-gray-950/30"
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = maxValue ? Math.max(6, Math.round(item.value / maxValue * 100)) : 0;
        return (
          <div className="space-y-1.5" key={item.id || item.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-gray-300">{item.label}</span>
              <span className="font-semibold text-gray-500">{formatNumber(item.value)}</span>
            </div>
            <div className="va-progress-rtl h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${width}%`,
                  background: "linear-gradient(to left, var(--va-action), var(--va-action-strong))"
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatLogDetails(details) {
  if (!details) return "";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

function getItemDurationSeconds(item = {}) {
  const candidates = [
    item.duration,
    item.durationSec,
    item.metadata?.duration,
    item.metadata?.media?.durationSec
  ];
  for (const value of candidates) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
    const match = String(value || "").match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (match) return (Number(match[1] || 0) * 3600) + (Number(match[2] || 0) * 60) + Number(match[3] || 0);
  }
  return 0;
}

function getFileTypeLabel(item = {}) {
  const source = [
    item.path,
    item.thumbnail,
    item.metadata?.localFile?.name,
    item.metadata?.localFile?.relativePath,
    item.metadata?.fileKey
  ].filter(Boolean).join(" ");
  const ext = source.match(/\.([a-z0-9]{2,5})(?:$|\?|\s)/i)?.[1]?.toLowerCase();
  if (!ext) return "غير محدد";
  if (["mp4", "mov", "mkv", "webm", "m4v"].includes(ext)) return "فيديو";
  if (["mp3", "wav", "m4a", "aac", "flac"].includes(ext)) return "صوت";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "صور";
  if (["pdf", "doc", "docx", "txt", "xlsx", "csv"].includes(ext)) return "مستندات";
  return ext.toUpperCase();
}

export function ReportsPage() {
  const {
    videoItems = [],
    contentTypes = [],
    auditLogs = [],
    virtualCollections = [],
    hierarchicalTags = [],
    vocabulary = [],
    users = [],
    settings = {},
    getStats
  } = useAppStore();

  const activeItems = videoItems.filter((item) => !item.isDeleted);
  const rawStats = typeof getStats === "function" ? getStats() : {};
  const toCount = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const stats = {
    total: toCount(rawStats.total ?? rawStats.activeItems, activeItems.length),
    favorites: toCount(rawStats.favorites ?? rawStats.favoriteItems, videoItems.filter((item) => item.isFavorite).length),
    deleted: toCount(rawStats.deleted ?? rawStats.deletedItems, videoItems.filter((item) => item.isDeleted).length)
  };

  const typeDistribution = React.useMemo(() => contentTypes.map((type) => ({
    id: type.id,
    label: type.name || type.id,
    value: activeItems.filter((item) => item.type === type.id).length
  })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value), [activeItems, contentTypes]);

  const monthlyDistribution = React.useMemo(() => {
    const counts = new Map();
    activeItems.forEach((item) => {
      const date = new Date(item.createdAt || item.updatedAt || Date.now());
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([label, value]) => ({ id: label, label, value }));
  }, [activeItems]);

  const qualityMetrics = React.useMemo(() => {
    const completeness = activeItems.map((item) => computeCompleteness(item, contentTypes.find((type) => type.id === item.type)));
    const averageCompleteness = completeness.length
      ? Math.round(completeness.reduce((sum, item) => sum + item.percent, 0) / completeness.length)
      : 0;
    const transcriptCount = activeItems.filter((item) => String(item.metadata?.transcript || item.transcript || "").trim()).length;
    const totalSeconds = activeItems.reduce((sum, item) => sum + getItemDurationSeconds(item), 0);
    return {
      averageCompleteness,
      transcriptCount,
      transcriptCoverage: activeItems.length ? Math.round(transcriptCount / activeItems.length * 100) : 0,
      totalSeconds
    };
  }, [activeItems, contentTypes]);

  const fileTypeDistribution = React.useMemo(() => {
    const counts = new Map();
    activeItems.forEach((item) => {
      const label = getFileTypeLabel(item);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, value]) => ({ id: label, label, value })).sort((a, b) => b.value - a.value);
  }, [activeItems]);

  const topTags = React.useMemo(() => computeTopTags(activeItems, 10), [activeItems]);

  const userProductivity = React.useMemo(() => {
    const counts = new Map();
    auditLogs.forEach((log) => {
      const label = log.username || "النظام";
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, value]) => ({ id: label, label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [auditLogs]);

  const recentLogs = React.useMemo(() => auditLogs
    .slice()
    .sort((a, b) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime())
    .slice(0, 8), [auditLogs]);

  const estimatedStorage = activeItems.length * 50 * 1024;
  const maxType = Math.max(1, ...typeDistribution.map((item) => item.value));
  const maxMonth = Math.max(1, ...monthlyDistribution.map((item) => item.value));
  const maxFileType = Math.max(1, ...fileTypeDistribution.map((item) => item.value));
  const maxProductivity = Math.max(1, ...userProductivity.map((item) => item.value));

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: stats.total,
      favorites: stats.favorites,
      deleted: stats.deleted,
      contentTypes: contentTypes.length,
      collections: virtualCollections.length,
      hierarchicalTags: hierarchicalTags.length,
      vocabulary: vocabulary.length,
      users: users.length
    },
    typeDistribution,
    monthlyDistribution,
    fileTypeDistribution,
    userProductivity,
    qualityMetrics,
    recentLogs
  };

  const exportJson = () => {
    downloadArchiveBlob(
      new Blob([JSON.stringify(reportPayload, null, 2)], { type: "application/json;charset=utf-8" }),
      `archive-report-${new Date().toISOString().slice(0, 10)}.json`
    );
  };

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    workbook.Workbook = { Views: [{ RTL: true }] };
    const appendSheet = (name, rows) => {
      const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "البيان": "لا توجد بيانات" }]);
      worksheet["!rtl"] = true;
      worksheet["!cols"] = Object.keys(rows[0] || { "البيان": "" }).map(() => ({ wch: 24 }));
      XLSX.utils.book_append_sheet(workbook, worksheet, name);
    };
    appendSheet("ملخص", [reportPayload.summary]);
    appendSheet("الأنواع", typeDistribution.map((item) => ({ "النوع": item.label, "العدد": item.value })));
    appendSheet("الشهور", monthlyDistribution.map((item) => ({ "الشهر": item.label, "العدد": item.value })));
    appendSheet("أنواع الملفات", fileTypeDistribution.map((item) => ({ "نوع الملف": item.label, "العدد": item.value })));
    appendSheet("إنتاجية المستخدمين", userProductivity.map((item) => ({ "المستخدم": item.label, "العمليات": item.value })));
    appendSheet("الجودة", [{
      "اكتمال التوصيف": `${qualityMetrics.averageCompleteness}%`,
      "تغطية التفريغ": `${qualityMetrics.transcriptCoverage}%`,
      "عدد التفريغات": qualityMetrics.transcriptCount,
      "إجمالي الثواني": qualityMetrics.totalSeconds
    }]);
    appendSheet("النشاط", recentLogs.map((log) => ({
      "المستخدم": log.username || "",
      "الحدث": log.eventType || "",
      "التفاصيل": formatLogDetails(log.details),
      "التاريخ": log.timestamp ? formatDateTime(log.timestamp, settings.numberSystem) : ""
    })));
    XLSX.writeFile(workbook, `archive-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportCsv = () => {
    const rows = [
      ["المؤشر", "القيمة"],
      ["العناصر النشطة", stats.total],
      ["اكتمال التوصيف", `${qualityMetrics.averageCompleteness}%`],
      ["تغطية التفريغ", `${qualityMetrics.transcriptCoverage}%`],
      ["إجمالي زمن المواد بالثواني", qualityMetrics.totalSeconds],
      ...typeDistribution.map((item) => [`نوع: ${item.label}`, item.value]),
      ...fileTypeDistribution.map((item) => [`ملف: ${item.label}`, item.value]),
      ...userProductivity.map((item) => [`مستخدم: ${item.label}`, item.value])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadArchiveBlob(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
      `archive-report-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const orgIndicators = [
    ["المستخدمون", users.length],
    ["المصطلحات", vocabulary.length],
    ["الأنواع", contentTypes.length],
    ["السجلات", auditLogs.length]
  ];

  return (
    <MotionPage className="space-y-6 p-4 sm:p-6">
      <PageHero
        icon={<ChartColumn className="h-6 w-6" style={{ color: "var(--va-action)" }} aria-hidden="true" />}
        title="التقارير والإحصائيات"
        description="ملخص بصري سريع لاتجاهات الأرشيف، توزيع الأنواع، النشاط الأخير، وقابلية التصدير."
        actions={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="btn btn-ghost va-secondary-button inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="btn btn-ghost va-secondary-button inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              JSON
            </button>
            <button
              type="button"
              onClick={exportExcel}
              className="btn btn-primary va-primary-button inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Excel
            </button>
          </div>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="مؤشرات">
        <MetricCard
          label="العناصر النشطة"
          value={formatNumber(stats.total, settings.numberSystem)}
          hint={`${formatNumber(stats.deleted || 0, settings.numberSystem)} في سلة المحذوفات`}
          icon={<Database className="h-5 w-5" aria-hidden="true" />}
          tone="accent"
        />
        <MetricCard
          label="المفضلة"
          value={formatNumber(stats.favorites || 0, settings.numberSystem)}
          hint="عناصر مميزة للرجوع السريع"
          icon={<FolderOpen className="h-5 w-5" aria-hidden="true" />}
          tone="amber"
        />
        <MetricCard
          label="المجموعات"
          value={formatNumber(virtualCollections.length, settings.numberSystem)}
          hint={`${formatNumber(hierarchicalTags.length, settings.numberSystem)} وسم هرمي`}
          icon={<HardDrive className="h-5 w-5" aria-hidden="true" />}
          tone="violet"
        />
        <MetricCard
          label="اكتمال التوصيف"
          value={`${formatNumber(qualityMetrics.averageCompleteness, settings.numberSystem)}%`}
          hint={`${formatNumber(qualityMetrics.transcriptCoverage, settings.numberSystem)}% تغطية تفريغ`}
          icon={<ChartColumn className="h-5 w-5" aria-hidden="true" />}
          tone="cyan"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="جودة الإنتاج">
        <MetricCard label="تفريغات" value={formatNumber(qualityMetrics.transcriptCount, settings.numberSystem)} hint="مواد لديها نص تفريغ" icon={<FileText className="h-5 w-5" aria-hidden="true" />} tone="accent" />
        <MetricCard label="إجمالي الزمن" value={formatNumber(Math.round(qualityMetrics.totalSeconds / 60), settings.numberSystem)} hint="بالدقائق حسب بيانات المدة" icon={<History className="h-5 w-5" aria-hidden="true" />} tone="amber" />
        <MetricCard label="تقدير التخزين" value={formatFileSize(estimatedStorage)} hint="تقدير داخلي للبيانات الوصفية" icon={<ChartColumn className="h-5 w-5" aria-hidden="true" />} tone="violet" />
        <MetricCard label="عمليات الفريق" value={formatNumber(auditLogs.length, settings.numberSystem)} hint="من سجل المراجعة" icon={<Users className="h-5 w-5" aria-hidden="true" />} tone="cyan" />
      </section>

      <FormSection
        icon={<ChartColumn className="h-5 w-5" style={{ color: "var(--va-action)" }} aria-hidden="true" />}
        title="الرسوم التفاعلية"
      >
        <InteractiveCharts growth={monthlyDistribution} types={typeDistribution} tags={topTags} />
      </FormSection>

      <section className="grid gap-6 xl:grid-cols-2">
        <FormSection
          icon={<FolderOpen className="h-5 w-5" style={{ color: "var(--va-action)" }} aria-hidden="true" />}
          title="التوزيع حسب النوع"
        >
          <BarList
            items={typeDistribution}
            maxValue={maxType}
            emptyTitle="لا توجد عناصر مصنفة بعد"
            emptyHint="سيظهر التوزيع بعد إضافة عناصر مرتبطة بأنواع محتوى."
          />
        </FormSection>

        <FormSection
          icon={<ChartColumn className="h-5 w-5" style={{ color: "var(--va-action)" }} aria-hidden="true" />}
          title="نشاط آخر 12 شهرًا"
        >
          <BarList
            items={monthlyDistribution}
            maxValue={maxMonth}
            emptyTitle="لا يوجد نشاط شهري بعد"
            emptyHint="سيظهر المخطط بعد إضافة أو استيراد عناصر بتاريخ إنشاء."
          />
        </FormSection>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <FormSection
          icon={<FileSpreadsheet className="h-5 w-5" style={{ color: "var(--va-action)" }} aria-hidden="true" />}
          title="توزيع أنواع الملفات"
        >
          <BarList items={fileTypeDistribution} maxValue={maxFileType} emptyTitle="لا توجد امتدادات ملف" emptyHint="ستظهر عند إضافة مسارات أو ملفات محلية." />
        </FormSection>

        <FormSection
          icon={<Users className="h-5 w-5" style={{ color: "var(--va-action)" }} aria-hidden="true" />}
          title="إنتاجية المستخدمين"
        >
          <BarList items={userProductivity} maxValue={maxProductivity} emptyTitle="لا يوجد نشاط مستخدمين" emptyHint="تظهر العمليات بعد إنشاء أو تعديل أو تصدير." />
        </FormSection>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <FormSection
          icon={<Users className="h-5 w-5" style={{ color: "var(--va-action)" }} aria-hidden="true" />}
          title="مؤشرات تنظيمية"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {orgIndicators.map(([label, value]) => (
              <div className="card rounded-xl va-surface-muted border p-3" key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-xl font-bold text-white">
                  {formatNumber(value, settings.numberSystem)}
                </p>
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection
          icon={<History className="h-5 w-5" style={{ color: "var(--va-action)" }} aria-hidden="true" />}
          title="آخر النشاط"
        >
          {recentLogs.length ? (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  className="card grid gap-2 rounded-xl va-surface-subtle border p-3 text-sm sm:grid-cols-[1fr_auto]"
                  key={log.id || `${log.eventType}-${log.timestamp}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-200">{log.eventType || "نشاط"}</p>
                    {log.details && (
                      <p className="mt-1 truncate text-xs text-gray-500">{formatLogDetails(log.details)}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-600">
                    {log.timestamp ? formatDateTime(log.timestamp, settings.numberSystem) : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <UXEmptyState
              icon={<History className="h-7 w-7" aria-hidden="true" />}
              title="لا توجد سجلات نشاط بعد"
              description="ستظهر آخر العمليات على الأرشيف هنا فور البدء بالاستخدام."
              className="bg-gray-950/30"
            />
          )}
        </FormSection>
      </section>
    </MotionPage>
  );
}

ReportsPage.pageId = "reports";
ReportsPage.migrationStatus = "native";

export default ReportsPage;
