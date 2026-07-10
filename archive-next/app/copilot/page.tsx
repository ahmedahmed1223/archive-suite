"use client";

import { BotMessageSquare, CopyCheck, DatabaseZap, RefreshCw, Search, ShieldCheck, Tags } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import type { CopilotStatus } from "@/lib/copilot-status";

type StatusPhase = "loading" | "ready" | "error";

const safeStartingPoints = [
  {
    title: "ابحث في الأرشيف",
    description: "استخدم البحث المتقدم مع الفلاتر بدل إرسال محتوى الأرشيف إلى خدمة خارجية.",
    href: "/search",
    icon: Search,
    label: "فتح البحث"
  },
  {
    title: "راجع العناصر المتشابهة",
    description: "اعرض التكرارات المحتملة وقرر الدمج أو الاحتفاظ بكل سجل من داخل النظام.",
    href: "/duplicates",
    icon: CopyCheck,
    label: "فتح المكررات"
  },
  {
    title: "نظّم البيانات الوصفية",
    description: "أدر الأنواع والوسوم والمفردات أولاً لتحسين نتائج البحث والعمل الجماعي.",
    href: "/tags",
    icon: Tags,
    label: "فتح الوسوم"
  }
] as const;

export default function CopilotPage() {
  const [phase, setPhase] = useState<StatusPhase>("loading");
  const [status, setStatus] = useState<CopilotStatus | null>(null);

  const refreshStatus = useCallback(async () => {
    setPhase("loading");
    try {
      const response = await fetch("/api/copilot/status", { cache: "no-store" });
      if (!response.ok) throw new Error("status_request_failed");

      const nextStatus = await response.json() as CopilotStatus;
      setStatus(nextStatus);
      setPhase("ready");
    } catch {
      setStatus(null);
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const statusLabel = phase === "loading"
    ? "جارٍ التحقق"
    : phase === "error"
      ? "تعذر التحقق"
      : status?.configured
        ? "تهيئة خادمية مرصودة"
        : "غير مهيأ";

  return (
    <AppShell subtitle="مساعد الأرشيف" navLabel="مسارات مساعد الأرشيف" contentClassName="copilot-content">
      <PageToolbar
        icon={<BotMessageSquare size={24} strokeWidth={1.8} />}
        eyebrow={<span className="badge">مساحة آمنة</span>}
        title="مساعد الأرشيف"
        description="نقطة دخول موجهة لعمليات الأرشيف. لا ترسل هذه الشاشة نصوصاً أو ملفات إلى أي مزود ذكاء اصطناعي."
        meta={(
          <>
            <span className="badge" data-tone={phase === "error" ? "danger" : undefined}>{statusLabel}</span>
            <span className="badge">معالجة خارجية: متوقفة</span>
          </>
        )}
        actions={(
          <button className="button button-secondary" type="button" onClick={() => void refreshStatus()} disabled={phase === "loading"}>
            <RefreshCw aria-hidden="true" size={17} strokeWidth={2} />
            إعادة التحقق
          </button>
        )}
      />

      {phase === "loading" ? (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">جارٍ فحص جاهزية المساعد على الخادم دون الاتصال بأي مزود خارجي…</p>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر فحص تهيئة المساعد</strong>
          <span className="helper-text">لا تزال المحادثة والتكاملات الخارجية معطلة. أعد المحاولة بعد التحقق من الخادم.</span>
        </div>
      ) : null}

      {phase === "ready" && !status?.configured ? (
        <div className="state-banner copilot-safety-banner" role="status">
          <ShieldCheck aria-hidden="true" size={20} strokeWidth={2} />
          <div>
            <strong>المساعد غير مهيأ خادمياً</strong>
            <span>تبقى المحادثة معطلة إلى أن يفعّل المسؤول مزوداً خادمياً محمياً ونقطة خدمة تراجع الصلاحيات.</span>
          </div>
        </div>
      ) : null}

      {phase === "ready" && status?.configured ? (
        <div className="state-banner copilot-safety-banner" role="status">
          <ShieldCheck aria-hidden="true" size={20} strokeWidth={2} />
          <div>
            <strong>رُصدت تهيئة خادمية، لكن لا توجد محادثة مفعلة هنا</strong>
            <span>لا تستدعي هذه الواجهة المزود الخارجي ولا تنقل إليه أي محتوى؛ يلزم ربط نقطة خدمة محمية ومراجعة الصلاحيات أولاً.</span>
          </div>
        </div>
      ) : null}

      <MetricStrip
        ariaLabel="حدود مساعد الأرشيف"
        items={[
          { label: "محادثات مرسلة", value: "0", description: "لا يوجد إرسال من المتصفح", icon: <BotMessageSquare size={20} />, tone: "accent" },
          { label: "محتوى خارجي", value: "محجوب", description: "لا ملفات ولا نصوص تغادر هذه الشاشة", icon: <ShieldCheck size={20} />, tone: "success" },
          { label: "مسارات آمنة", value: safeStartingPoints.length, description: "ابدأ بعمليات النظام الحالية", icon: <DatabaseZap size={20} />, tone: "info" }
        ]}
      />

      <section className="copilot-workspace" aria-label="مساحة مساعد الأرشيف">
        <article className="panel copilot-conversation" aria-labelledby="copilot-conversation-title">
          <div className="panel-section-header">
            <h2 id="copilot-conversation-title">محادثة المساعد</h2>
            <p>ستظهر المحادثات المراجعة خادمياً هنا بعد إضافة نقطة الخدمة المحمية.</p>
          </div>
          <EmptyState
            icon={<BotMessageSquare size={24} strokeWidth={1.8} />}
            title="لا توجد محادثات بعد"
            description="هذه مساحة فارغة مقصودة: لا تُنشأ أي طلبات ذكاء اصطناعي أو طلبات خارجية من هذا المتصفح."
          />
          <fieldset className="copilot-composer" disabled aria-describedby="copilot-composer-note">
            <label htmlFor="copilot-prompt">اكتب طلبك</label>
            <textarea id="copilot-prompt" className="search-input" placeholder="المحادثة غير متاحة حتى اكتمال التهيئة الخادمية الآمنة." />
            <div className="button-row">
              <button className="button button-primary" type="button">
                <BotMessageSquare aria-hidden="true" size={17} strokeWidth={2} />
                إرسال إلى المساعد
              </button>
            </div>
          </fieldset>
          <p id="copilot-composer-note" className="helper-text">الحقل معطل عمداً، ولا تحفظ هذه الصفحة أي مسودة في المتصفح.</p>
        </article>

        <aside className="copilot-guidance" aria-label="مسارات آمنة مقترحة">
          <div className="panel-section-header">
            <h2>ابدأ من النظام</h2>
            <p>بدائل عملية متاحة الآن دون انتظار أي تكامل خارجي.</p>
          </div>
          <div className="copilot-guidance__list">
            {safeStartingPoints.map(({ title, description, href, icon: Icon, label }) => (
              <article className="workspace-panel copilot-guidance__item" key={href}>
                <Icon className="copilot-guidance__icon" aria-hidden="true" size={20} strokeWidth={1.8} />
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <a className="button button-secondary" href={href}>{label}</a>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
