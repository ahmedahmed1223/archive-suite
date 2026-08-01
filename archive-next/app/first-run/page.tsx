"use client";

import { CheckCircle2, Circle, ExternalLink, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import FirstRunTour from "@/components/FirstRunTour";
import { BRAND } from "@/lib/brand";
import { createArchiveApiClient, type OnboardingProgress, type OnboardingStageId } from "@/lib/archive-api";
import { useAuthSession } from "@/lib/auth-session";
import { toOnboardingProgressSteps } from "@/lib/onboarding-progress";
import { deriveSetupJourney, type SetupStepId } from "@/lib/setup-journey";
import {
  ONBOARDING_PRESET_STORAGE_KEY,
  onboardingChecklist,
  onboardingPresets,
  type OnboardingPreset
} from "@/lib/onboarding";

type HealthState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; backend: string; engine: string; uptimeSec: number }
  | { status: "error"; message: string };

const EXPERT_SKIP_STORAGE_KEY = "masar:first-run:expert-skip:v1";
const INTERACTIVE_TEST_FEEDBACK_STORAGE_KEY = "masar:interactive-test-feedback:v1";

type ProgressState =
  | { status: "idle" | "loading" }
  | { status: "ready"; progress: OnboardingProgress }
  | { status: "error"; message: string };

function formatUptime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "غير معروف";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `${Math.floor(seconds)} ثانية`;
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes} دقيقة`;
  return `${hours} ساعة و${minutes % 60} دقيقة`;
}

export default function FirstRunPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const auth = useAuthSession();
  const [preset, setPreset] = useState<OnboardingPreset>("quick");
  const [progressState, setProgressState] = useState<ProgressState>({ status: "idle" });
  const [updatingStage, setUpdatingStage] = useState<OnboardingStageId | null>(null);
  const [health, setHealth] = useState<HealthState>({ status: "idle" });
  const [expertSkip, setExpertSkip] = useState(false);
  const [interactiveTestFeedback, setInteractiveTestFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const currentPreset = onboardingPresets[preset];
  const progressSteps = progressState.status === "ready" ? toOnboardingProgressSteps(progressState.progress) : [];
  const completedCount = progressSteps.filter((step) => step.completed).length;
  const isComplete = progressSteps.length === 5 && completedCount === progressSteps.length;
  const isAdmin = auth.user?.role === "admin";
  const journey = deriveSetupJourney(
    {
      status: health.status === "ready" ? "healthy" : health.status === "error" ? "offline" : health.status === "loading" ? "checking" : "unknown",
      ...(health.status === "error" ? { message: health.message } : {})
    },
    { status: auth.status },
    {
      settingsReviewed: isComplete,
      expertMode: expertSkip,
      skipGuidedSetup: expertSkip
    }
  );
  const journeySteps: Array<{ id: SetupStepId; title: string; description: string }> = [
    { id: "server", title: "تشغيل الخادم", description: "فحص API ومحرك البيانات تلقائياً." },
    { id: "account", title: "تأكيد الدخول", description: "سجّل الدخول عند الحاجة لاستئناف التهيئة المحفوظة." },
    { id: "settings", title: "مراجعة الإعدادات", description: "اختبار الاتصالات ومراجعة إعدادات التشغيل." },
    { id: "ready", title: "بدء العمل", description: "الانتقال إلى مساحة العمل بعد اكتمال الجاهزية." }
  ];

  useEffect(() => {
    const storedPreset = window.localStorage.getItem(ONBOARDING_PRESET_STORAGE_KEY);
    const nextPreset = storedPreset === "advanced" ? "advanced" : "quick";
    setPreset(nextPreset);
    setExpertSkip(window.localStorage.getItem(EXPERT_SKIP_STORAGE_KEY) === "true");
    setInteractiveTestFeedback(window.localStorage.getItem(INTERACTIVE_TEST_FEEDBACK_STORAGE_KEY) || "");
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void loadProgress();
    }
    // تغيّر الجلسة هو سبب إعادة التحميل الوحيد؛ العميل ثابت داخل الصفحة.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status]);

  useEffect(() => {
    void checkHealth();
    // الفحص تلقائي مرة واحدة عند فتح الرحلة؛ يظل زر إعادة الفحص متاحاً.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkHealth() {
    setHealth({ status: "loading" });

    try {
      const response = await api.health();
      if (!response.ok) {
        setHealth({ status: "error", message: response.error || "تعذر الوصول إلى API." });
        return;
      }

      setHealth({
        status: "ready",
        backend: response.backend,
        engine: response.engine,
        uptimeSec: response.uptimeSec
      });
    } catch (error) {
      setHealth({
        status: "error",
        message: error instanceof Error ? error.message : "تعذر الوصول إلى API."
      });
    }
  }

  async function loadProgress() {
    setProgressState({ status: "loading" });

    try {
      const response = await api.onboardingProgress(
        auth.accessToken ? { accessToken: auth.accessToken } : undefined,
      );
      if (!response.ok) {
        setProgressState({ status: "error", message: response.error || "تعذر تحميل تقدم أول تشغيل." });
        return;
      }
      setProgressState({ status: "ready", progress: response.progress });
    } catch (error) {
      setProgressState({
        status: "error",
        message: error instanceof Error ? error.message : "تعذر تحميل تقدم أول تشغيل."
      });
    }
  }

  function changePreset(nextPreset: OnboardingPreset) {
    setPreset(nextPreset);
    window.localStorage.setItem(ONBOARDING_PRESET_STORAGE_KEY, nextPreset);
  }

  async function updateProgressStage(stepId: OnboardingStageId, completed: boolean) {
    if (!isAdmin || progressState.status !== "ready") return;

    setUpdatingStage(stepId);
    try {
      const response = await api.updateOnboardingStage(
        stepId,
        { status: completed ? "pending" : "completed" },
        auth.accessToken ? { accessToken: auth.accessToken } : undefined,
      );
      if (!response.ok) {
        setProgressState({ status: "error", message: response.error || "تعذر حفظ تقدم أول تشغيل." });
        return;
      }
      setProgressState({ status: "ready", progress: response.progress });
    } catch (error) {
      setProgressState({
        status: "error",
        message: error instanceof Error ? error.message : "تعذر حفظ تقدم أول تشغيل."
      });
    } finally {
      setUpdatingStage(null);
    }
  }

  function toggleExpertSkip(checked: boolean) {
    setExpertSkip(checked);
    window.localStorage.setItem(EXPERT_SKIP_STORAGE_KEY, String(checked));
  }

  function updateInteractiveTestFeedback(value: string) {
    setInteractiveTestFeedback(value);
    setFeedbackStatus("");
    window.localStorage.setItem(INTERACTIVE_TEST_FEEDBACK_STORAGE_KEY, value);
  }

  async function copyInteractiveTestFeedback() {
    const note = interactiveTestFeedback.trim();
    if (!note) return;

    try {
      await navigator.clipboard.writeText(`ملاحظات الفحص التفاعلي\n${note}`);
      setFeedbackStatus("تم النسخ. ألصق الملاحظات في محادثة المتابعة.");
    } catch {
      setFeedbackStatus("تعذر النسخ تلقائيًا. انسخ النص من الحقل وأرسله في محادثة المتابعة.");
    }
  }

  return (
    <AppShell subtitle="أول تشغيل" navLabel="مسار التهيئة" contentClassName="first-run-content" tipsPage="first-run">
      <PageToolbar
        eyebrow={<span className="badge">أول تشغيل</span>}
        title={`تهيئة ${BRAND.arabicName}`}
        description="اتبع الخطوة الحالية، ثم نفّذ تعليمات المسار الذي اخترته. لا يظهر تسجيل الدخول إلا عندما يصبح مطلوبًا لاستئناف التهيئة."
        meta={(
          <>
            <span className="badge">setup.bat</span>
            <span className="badge">Control Center</span>
            <span className="badge">{completedCount}/5 مراحل مؤسسية مكتملة</span>
            <span className="badge">الجاهزية {journey.readinessPercentage}%</span>
          </>
        )}
        actions={(
          <>
            <button type="button" className="button button-secondary" onClick={() => void checkHealth()}>
              <RefreshCw aria-hidden="true" size={16} />
              فحص الصحة
            </button>
            <FirstRunTour />
            <a className="button button-secondary" href="/help">المساعدة</a>
            {auth.status === "authenticated" ? <a className="button button-primary" href="/">فتح مساحة العمل</a> : null}
          </>
        )}
      />

      <div className="first-run-workspace-grid">
      <section className="panel first-run-journey" aria-label="رحلة الجاهزية" aria-live="polite">
        <div className="panel-section-header helper-row">
          <div>
            <h2>رحلة الإعداد الموحدة</h2>
            <p>الخطوة الحالية: {journeySteps.find((step) => step.id === journey.currentStep)?.title}</p>
          </div>
          <a className="button button-primary" href={journey.nextAction.href}>{journey.nextAction.label}</a>
        </div>
        <progress max={100} value={journey.readinessPercentage} aria-label={`جاهزية النظام ${journey.readinessPercentage}%`} />
        <label className="checklist-control">
          <input
            type="checkbox"
            checked={expertSkip}
            onChange={(event) => toggleExpertSkip(event.target.checked)}
          />
          <span>تخطي مراجعة الإعدادات للمستخدم الخبير</span>
        </label>
        <p className="helper-text">يتخطى هذا الخيار مراجعة الإعدادات فقط؛ لا يتجاوز فحص الخادم أو تسجيل الدخول.</p>
        <ol className="first-run-steps">
          {journeySteps.map((step, index) => (
            <li key={step.id} className="first-run-step" data-complete={journey.completedSteps.includes(step.id) ? "true" : "false"}>
              <div className="first-run-step__body">
                <span className="badge">خطوة {index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="page-section first-run-preset" aria-labelledby="preset-heading">
        <div className="panel">
          <div className="panel-section-header">
            <h2 id="preset-heading">اختر مسار التهيئة</h2>
            <p>المساران يستخدمان `setup.bat` كواجهة آمنة لـ `scripts/control-center.mjs`؛ لا تعرض الأسرار إلا عند توليد كلمة مرور المدير أول مرة.</p>
          </div>
          <div className="view-switcher" role="group" aria-label="اختيار preset التهيئة">
            {(Object.keys(onboardingPresets) as OnboardingPreset[]).map((key) => (
              <button
                key={key}
                type="button"
                className="view-switcher__button"
                aria-pressed={preset === key}
                onClick={() => changePreset(key)}
              >
                {onboardingPresets[key].label}
              </button>
            ))}
          </div>
          <div className="first-run-command">
            <div>
              <strong>{currentPreset.label}</strong>
              <p>{currentPreset.summary}</p>
            </div>
            <code dir="ltr">{currentPreset.command}</code>
          </div>
          <ol className="first-run-steps" aria-label="خطوات التهيئة المختارة">
            {currentPreset.steps.map((step, index) => (
              <li className="first-run-step" key={step.id}>
                <div className="first-run-step__body">
                  <span className="badge">خطوة {index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  {step.command ? <code>{step.command}</code> : null}
                  {step.href ? <a className="button button-secondary button-sm" href={step.href}>{step.actionLabel}</a> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="page-section first-run-health" aria-labelledby="health-heading">
        <div className="dense-grid">
          <article className="health-metric" data-tone={health.status === "ready" ? "success" : health.status === "error" ? "danger" : "accent"}>
            <div className="health-metric__icon">
              <Server aria-hidden="true" size={20} />
            </div>
            <div className="health-metric__body">
              <span id="health-heading">الخادم</span>
              <strong>
                {health.status === "ready"
                  ? "متصل"
                  : health.status === "loading"
                    ? "جار الفحص"
                    : health.status === "error"
                      ? "غير متصل"
                      : "لم يفحص بعد"}
              </strong>
              <small>
                {health.status === "ready"
                  ? `${health.backend} · ${health.engine} · ${formatUptime(health.uptimeSec)}`
                  : health.status === "error"
                    ? health.message
                    : "استخدم فحص الصحة بعد تشغيل stack."}
              </small>
            </div>
          </article>

          <article className="health-metric" data-tone={isComplete ? "success" : "warning"}>
            <div className="health-metric__icon">
              <ShieldCheck aria-hidden="true" size={20} />
            </div>
            <div className="health-metric__body">
              <span>جاهزية البداية</span>
              <strong>{isComplete ? "مكتملة" : "قيد التهيئة"}</strong>
              <small>{isComplete ? "لن يظهر تذكير البداية في الصفحات." : "أكمل الخطوات أو افتح الجولة لاحقاً من المساعدة/الإعدادات."}</small>
            </div>
          </article>
        </div>
      </section>

      <section className="page-section first-run-progress" aria-labelledby="steps-heading">
        <article className="panel">
          <div className="panel-section-header helper-row">
            <div>
              <h2 id="steps-heading">مراحل أول استخدام المؤسسة</h2>
              <p>هذه الحالة محفوظة للمؤسسة وتُستأنف بعد تسجيل الدخول أو من جهاز آخر.</p>
            </div>
            {progressState.status === "error" ? (
              <button type="button" className="button button-secondary button-sm" onClick={() => void loadProgress()}>
                <RefreshCw aria-hidden="true" size={15} />
                إعادة المحاولة
              </button>
            ) : null}
          </div>

          {auth.status === "guest" ? (
            <p className="helper-text">سجّل الدخول لعرض تقدم المؤسسة المحفوظ واستئناف الخطوة التالية.</p>
          ) : null}
          {auth.status === "guest" ? <a className="button button-primary button-sm" href="/login?next=%2Ffirst-run">تسجيل الدخول</a> : null}
          {auth.status !== "guest" && progressState.status !== "ready" ? (
            <p className="helper-text" role="status">{progressState.status === "error" ? progressState.message : "جار تحميل تقدم أول تشغيل..."}</p>
          ) : null}
          {progressState.status === "ready" ? (
            <ol className="first-run-steps">
              {progressSteps.map((step, index) => (
                <li key={step.id} className="first-run-step" data-complete={step.completed ? "true" : "false"}>
                  {isAdmin ? (
                    <button
                      type="button"
                      className="first-run-step__toggle"
                      onClick={() => void updateProgressStage(step.id, step.completed)}
                      aria-pressed={step.completed}
                      aria-label={`${step.completed ? "إلغاء إكمال" : "إكمال"} ${step.title}`}
                      disabled={updatingStage === step.id}
                    >
                      {step.completed ? <CheckCircle2 aria-hidden="true" size={20} /> : <Circle aria-hidden="true" size={20} />}
                    </button>
                  ) : (
                    <span className="first-run-step__toggle" aria-hidden="true">
                      {step.completed ? <CheckCircle2 aria-hidden="true" size={20} /> : <Circle aria-hidden="true" size={20} />}
                    </span>
                  )}
                  <div className="first-run-step__body">
                    <span className="badge">مرحلة {index + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    <a className="button button-secondary button-sm" href={step.href}>
                      {step.actionLabel}
                      <ExternalLink aria-hidden="true" size={15} />
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </article>
      </section>

      {isAdmin ? (
        <section className="page-section first-run-defaults" aria-labelledby="defaults-heading">
          <article className="panel">
            <div className="panel-section-header">
              <h2 id="defaults-heading">تصنيفات ووسوم افتراضية جاهزة</h2>
              <p>استيراد اختياري وإضافي فقط — لا يكتب فوق أي نوع أو وسم موجود مسبقاً.</p>
            </div>
            <div className="first-run-command">
              <a className="button button-secondary" href="/types">استيراد التصنيفات الافتراضية</a>
              <a className="button button-secondary" href="/vocabulary">استيراد الوسوم الافتراضية</a>
            </div>
          </article>
        </section>
      ) : null}

      <section className="page-section first-run-feedback" aria-labelledby="interactive-test-feedback-heading">
        <article className="panel stack">
          <div className="panel-section-header">
            <h2 id="interactive-test-feedback-heading">ملاحظات الفحص التفاعلي</h2>
            <p>دوّن أي تعديل مطلوب أثناء الفحص. تُحفظ الملاحظات على هذا الجهاز، ثم انسخها وأرسلها في محادثة المتابعة.</p>
          </div>
          <textarea
            value={interactiveTestFeedback}
            onChange={(event) => updateInteractiveTestFeedback(event.target.value)}
            aria-label="ملاحظات الفحص التفاعلي"
            placeholder="مثال: في خطوة إضافة مادة، أريد تبسيط حقل التصنيف…"
            rows={5}
          />
          <div className="button-row">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => void copyInteractiveTestFeedback()}
              disabled={!interactiveTestFeedback.trim()}
            >
              نسخ ملاحظات الفحص
            </button>
            {feedbackStatus ? <p className="helper-text" role="status">{feedbackStatus}</p> : null}
          </div>
        </article>
      </section>

      <section className="page-section first-run-security" aria-labelledby="security-heading">
        <article className="panel">
          <div className="panel-section-header">
            <h2 id="security-heading">تنبيهات آمنة لأول تشغيل</h2>
          </div>
          <ul className="checklist">
            {onboardingChecklist.map((item) => (
              <li className="checklist-item" key={item}>
                <CheckCircle2 aria-hidden="true" size={18} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
      </div>
    </AppShell>
  );
}
