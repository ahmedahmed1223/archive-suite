"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Clock3, Database, FileBarChart, Gauge, LineChart, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { getContractSummary } from "@/lib/archive-api";
import { BRAND } from "@/lib/brand";
import "./reports.css";

const contract = getContractSummary();

type ReportCategory = "all" | "operations" | "media" | "rights" | "people";

const categoryLabels: Record<ReportCategory, string> = {
  all: "الكل",
  operations: "تشغيلي",
  media: "وسائط",
  rights: "حقوق",
  people: "استخدام"
};

const reportChecks = [
  {
    title: "عقد التقارير",
    status: "جاهز",
    body: `يعتمد المسار على عقد ${BRAND.latinName} API v${contract.version} قبل نقل أي تقرير تشغيلي حقيقي.`,
    score: 92,
    tone: "success",
    icon: ShieldCheck
  },
  {
    title: "مصدر الحقيقة",
    status: "Ø§ÙØ®Ø§Ø¯Ù",
    body: "تبقى الحسابات الثقيلة والتجميعات طويلة المدى في الخادم، وتعرض Next النتائج فقط لتجنب ازدواجية المنطق.",
    score: 84,
    tone: "info",
    icon: Database
  },
  {
    title: "بوابة القبول",
    status: "إلزامية",
    body: "كل تقرير ينتقل لاحقا يحتاج typecheck، build مستقل، وفحص Playwright يغطي سطح العرض الأساسي.",
    score: 76,
    tone: "warning",
    icon: CheckCircle2
  }
] as const;

const plannedReports = [
  {
    id: "archive-volume",
    title: "حجم الأرشيف حسب المخزن والنوع",
    category: "operations",
    status: "جاهز للتصميم",
    readiness: 78,
    cadence: "أسبوعي",
    owner: "فريق البيانات",
    href: "/analytics",
    summary: "يعرض نمو السجلات، توزيع المخازن، والأنواع التي تحتاج تنظيف metadata.",
    metrics: ["عدد السجلات", "النمو الشهري", "توزيع المخازن"],
    blockers: ["اعتماد تكلفة التخزين من الخادم", "ربط حصص المخازن"]
  },
  {
    id: "media-processing",
    title: "سجل المعالجة الإعلامية والفشل",
    category: "media",
    status: "قابل للبناء",
    readiness: 68,
    cadence: "يومي",
    owner: "فريق الوسائط",
    href: "/media/jobs",
    summary: "يربط مهام التفريغ والتحويل والفشل بزمن التنفيذ وحالة كل مادة.",
    metrics: ["نسبة الفشل", "زمن الانتظار", "المهام المكتملة"],
    blockers: ["تثبيت أسباب الفشل القياسية", "تجميع أحداث queue"]
  },
  {
    id: "rights-expiry",
    title: "ملخص الحقوق وانتهاء التراخيص",
    category: "rights",
    status: "يحتاج مراجعة",
    readiness: 58,
    cadence: "شهري",
    owner: "فريق الحقوق",
    href: "/rights",
    summary: "يركز على المواد التي اقترب انتهاء حقوقها ومسارات الاستخدام المحظورة.",
    metrics: ["تراخيص منتهية", "حقوق مقيدة", "مواد قابلة للنشر"],
    blockers: ["توحيد حقول التاريخ", "مراجعة تصنيفات الاستخدام"]
  },
  {
    id: "user-activity",
    title: "نشاط المستخدمين والتعديلات",
    category: "people",
    status: "جاهز أولي",
    readiness: 72,
    cadence: "يومي",
    owner: "مدير الأرشيف",
    href: "/activity",
    summary: "يختصر التعديلات، الرفض، والتكرارات في سجل النشاط لتسهيل المتابعة.",
    metrics: ["أحداث ناجحة", "رفض وتكرار", "أكثر الموارد تغيرا"],
    blockers: ["تسمية أحداث audit", "تحديد مؤشرات SLA"]
  }
] as const;

type ReportId = (typeof plannedReports)[number]["id"];

function reportProgressStyle(value: number) {
  return { "--report-progress": `${value}%` } as CSSProperties;
}

function readinessTone(value: number) {
  if (value >= 75) return "success";
  if (value >= 65) return "info";
  return "warning";
}

export default function ReportsPage() {
  const [category, setCategory] = useState<ReportCategory>("all");
  const [selectedReportId, setSelectedReportId] = useState<ReportId>(plannedReports[0].id);
  const filteredReports = useMemo(
    () => plannedReports.filter((report) => category === "all" || report.category === category),
    [category]
  );
  const selectedReport = filteredReports.find((report) => report.id === selectedReportId) ?? filteredReports[0] ?? plannedReports[0];
  const averageReadiness = Math.round(plannedReports.reduce((total, report) => total + report.readiness, 0) / plannedReports.length);
  const readyReports = plannedReports.filter((report) => report.readiness >= 70).length;

  return (
    <AppShell subtitle="التقارير" navLabel="التقارير" contentClassName="observability-content">
      <PageToolbar
        icon={<FileBarChart size={24} />}
        eyebrow={<span className="badge">تقارير تشغيلية</span>}
        title="لوحة التقارير"
        description="مساحة اختيار وتقييم لتقارير الخادم القادمة: ما الجاهز، ما يحتاج عقد بيانات، وما يمكن فتحه من صفحات المراقبة الحالية."
        meta={
          <>
            <span className="badge">API v{contract.version}</span>
            <span className="badge">{contract.routeCount} مسار موثق</span>
            <span className="badge">{averageReadiness}% جاهزية</span>
            <span className="badge">{readyReports} تقارير قابلة للبناء</span>
          </>
        }
        actions={
          <>
            <a className="button button-primary" href="/analytics">
              <BarChart3 size={16} aria-hidden="true" />
              التحليلات الحالية
            </a>
            <a className="button button-secondary" href="/activity">
              <Clock3 size={16} aria-hidden="true" />
              النشاط
            </a>
          </>
        }
      >
        <div className="report-control-strip" role="group" aria-label="تصفية التقارير">
          {(Object.keys(categoryLabels) as ReportCategory[]).map((option) => (
            <button
              key={option}
              type="button"
              className="badge"
              data-active={category === option ? "true" : "false"}
              onClick={() => setCategory(option)}
            >
              {categoryLabels[option]}
            </button>
          ))}
        </div>
      </PageToolbar>

      <div className="report-readiness-grid">
        {reportChecks.map((item) => (
          <article className="panel report-check-card" key={item.title} data-tone={item.tone}>
            <div className="panel-title-row">
              <div className="report-check-card__title">
                <span className="report-check-card__icon" aria-hidden="true">
                  <item.icon size={20} />
                </span>
                <h2>{item.title}</h2>
              </div>
              <span className="badge">{item.status}</span>
            </div>
            <p>{item.body}</p>
            <div className="report-readiness-meter" style={reportProgressStyle(item.score)} aria-label={`جاهزية ${item.title}: ${item.score}%`}>
              <span />
            </div>
          </article>
        ))}
      </div>

      <section className="report-workspace" aria-label="مساحة التقارير المخططة">
        <div className="report-catalog" role="list" aria-label="التقارير">
          {filteredReports.map((report) => (
            <button
              key={report.id}
              type="button"
              className="report-catalog-card"
              data-active={selectedReport.id === report.id ? "true" : "false"}
              data-tone={readinessTone(report.readiness)}
              onClick={() => setSelectedReportId(report.id)}
            >
              <span className="report-catalog-card__meta">
                <span>{categoryLabels[report.category]}</span>
                <strong>{report.readiness}%</strong>
              </span>
              <span className="report-catalog-card__title">{report.title}</span>
              <span className="report-catalog-card__footer">
                <span>{report.status}</span>
                <span>{report.cadence}</span>
              </span>
            </button>
          ))}
        </div>

        <aside className="workspace-panel report-preview-panel" aria-label="معاينة التقرير المحدد">
          <div className="workspace-panel__header">
            <div>
              <span className="badge"><Gauge size={14} aria-hidden="true" /> {selectedReport.readiness}% جاهزية</span>
              <h2>{selectedReport.title}</h2>
              <p>{selectedReport.summary}</p>
            </div>
          </div>
          <div className="report-readiness-meter report-readiness-meter--large" style={reportProgressStyle(selectedReport.readiness)}>
            <span />
          </div>
          <div className="report-signal-grid">
            <div>
              <Clock3 size={16} aria-hidden="true" />
              <span>الدورية</span>
              <strong>{selectedReport.cadence}</strong>
            </div>
            <div>
              <Workflow size={16} aria-hidden="true" />
              <span>الحالة</span>
              <strong>{selectedReport.status}</strong>
            </div>
            <div>
              <Sparkles size={16} aria-hidden="true" />
              <span>المالك</span>
              <strong>{selectedReport.owner}</strong>
            </div>
          </div>
          <div className="report-preview-panel__section">
            <strong>المؤشرات الأساسية</strong>
            <div className="analytics-chip-list">
              {selectedReport.metrics.map((metric) => <span key={metric} className="tag">{metric}</span>)}
            </div>
          </div>
          <div className="report-preview-panel__section">
            <strong>ما قبل البناء</strong>
            <ul className="report-check-list">
              {selectedReport.blockers.map((blocker) => (
                <li key={blocker}>
                  <LineChart size={15} aria-hidden="true" />
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="button-row">
            <a className="button button-primary" href={selectedReport.href}>فتح المصدر الحالي</a>
            <a className="button button-secondary" href="/status">فحص الجاهزية</a>
          </div>
        </aside>
      </section>

      <section className="panel report-roadmap-panel">
        <div className="panel-title-row">
          <div>
            <h2>التقارير المخططة</h2>
            <p>ترتيب موجز يحفظ تكافؤ المزايا المطلوبة قبل تحويل كل تقرير إلى صفحة بيانات كاملة.</p>
          </div>
          <span className="badge">{plannedReports.length} مسارات</span>
        </div>
        <div className="report-roadmap">
          {plannedReports.map((report, index) => (
            <div className="report-roadmap__item" key={report.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{report.title}</strong>
              <small>{report.status}</small>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
