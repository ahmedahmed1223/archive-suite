"use client";

import { CheckCircle2, Circle, ExternalLink, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import FirstRunTour from "@/components/FirstRunTour";
import { BRAND } from "@/lib/brand";
import { createArchiveApiClient, type OnboardingProgress, type OnboardingStageId } from "@/lib/archive-api";
import { useAuthSession } from "@/lib/auth-session";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { toOnboardingProgressSteps } from "@/lib/onboarding-progress";
import { deriveSetupJourney, type SetupStepId } from "@/lib/setup-journey";
import {
  ONBOARDING_PRESET_STORAGE_KEY,
  getOnboardingChecklist,
  getOnboardingPresets,
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

function formatUptime(seconds: number, locale: "ar" | "en") {
  if (!Number.isFinite(seconds) || seconds < 0) return locale === "en" ? "Unknown" : "غير معروف";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return locale === "en" ? `${Math.floor(seconds)} seconds` : `${Math.floor(seconds)} ثانية`;
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return locale === "en" ? `${minutes} minutes` : `${minutes} دقيقة`;
  return locale === "en" ? `${hours} hours ${minutes % 60} minutes` : `${hours} ساعة و${minutes % 60} دقيقة`;
}

export default function FirstRunPage() {
  const { locale } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const auth = useAuthSession();
  const [preset, setPreset] = useState<OnboardingPreset>("quick");
  const [progressState, setProgressState] = useState<ProgressState>({ status: "idle" });
  const [updatingStage, setUpdatingStage] = useState<OnboardingStageId | null>(null);
  const [health, setHealth] = useState<HealthState>({ status: "idle" });
  const [expertSkip, setExpertSkip] = useState(false);
  const [interactiveTestFeedback, setInteractiveTestFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const presets = getOnboardingPresets(locale);
  const checklist = getOnboardingChecklist(locale);
  const currentPreset = presets[preset];
  const progressSteps = progressState.status === "ready" ? toOnboardingProgressSteps(progressState.progress, locale) : [];
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
  const copy = locale === "en" ? {
    subtitle: "First run", navLabel: "Setup journey", eyebrow: "First run", title: `Set up ${BRAND.latinName}`, description: "Follow the current step, then complete the instructions for the path you selected. Sign-in appears only when it is needed to resume setup.", stages: "organization stages complete", readiness: "Readiness", healthCheck: "Check health", help: "Help", openWorkspace: "Open workspace", journey: "Unified setup journey", currentStep: "Current step", readinessLabel: "System readiness", skip: "Skip the settings review for an expert user", skipHelp: "This skips only the settings review; it never bypasses the server check or sign-in.", step: "Step", choose: "Choose a setup path", presetLabel: "Choose a setup preset", setupHelp: "Both paths use setup.bat as a safe interface for scripts/control-center.mjs; secrets appear only when the administrator password is generated for the first time.", selectedSteps: "Selected setup steps", server: "Server", connected: "Connected", checking: "Checking", offline: "Offline", notChecked: "Not checked", startHealth: "Use Check health after starting the stack.", startupReady: "Startup readiness", complete: "Complete", configuring: "Being configured", completeHelp: "The startup reminder will no longer appear in pages.", incompleteHelp: "Complete the steps, or open the tour later from Help or Settings.", orgStages: "Organization first-use stages", orgHelp: "This organization-wide state is saved and resumes after sign-in or on another device.", retry: "Try again", signInHelp: "Sign in to view the saved organization progress and resume the next step.", signIn: "Sign in", loadingProgress: "Loading first-run progress…", undo: "Mark incomplete", mark: "Mark complete", stage: "Stage", defaults: "Ready-to-use default types and tags", defaultsHelp: "Optional, additive imports only — they never overwrite an existing type or tag.", importTypes: "Import default types", importTags: "Import default tags", feedback: "Interactive test notes", feedbackHelp: "Record any change needed during testing. Notes stay on this device; then copy them into the follow-up conversation.", feedbackLabel: "Interactive test notes", feedbackPlaceholder: "Example: On the add-record step, I would like the classification field to be simpler…", copyNotes: "Copy test notes", copied: "Copied. Paste the notes into the follow-up conversation.", copyFailed: "Could not copy automatically. Copy the text from the field and send it in the follow-up conversation.", security: "Safe first-run reminders", apiError: "Could not reach the API.", progressError: "Could not load first-run progress.", progressSaveError: "Could not save first-run progress.", notesHeading: "Interactive test notes"
  } : {
    subtitle: "أول تشغيل", navLabel: "مسار التهيئة", eyebrow: "أول تشغيل", title: `تهيئة ${BRAND.arabicName}`, description: "اتبع الخطوة الحالية، ثم نفّذ تعليمات المسار الذي اخترته. لا يظهر تسجيل الدخول إلا عندما يصبح مطلوبًا لاستئناف التهيئة.", stages: "مراحل مؤسسية مكتملة", readiness: "الجاهزية", healthCheck: "فحص الصحة", help: "المساعدة", openWorkspace: "فتح مساحة العمل", journey: "رحلة الإعداد الموحدة", currentStep: "الخطوة الحالية", readinessLabel: "جاهزية النظام", skip: "تخطي مراجعة الإعدادات للمستخدم الخبير", skipHelp: "يتخطى هذا الخيار مراجعة الإعدادات فقط؛ لا يتجاوز فحص الخادم أو تسجيل الدخول.", step: "خطوة", choose: "اختر مسار التهيئة", presetLabel: "اختيار preset التهيئة", setupHelp: "المساران يستخدمان setup.bat كواجهة آمنة لـ scripts/control-center.mjs؛ لا تعرض الأسرار إلا عند توليد كلمة مرور المدير أول مرة.", selectedSteps: "خطوات التهيئة المختارة", server: "الخادم", connected: "متصل", checking: "جار الفحص", offline: "غير متصل", notChecked: "لم يفحص بعد", startHealth: "استخدم فحص الصحة بعد تشغيل stack.", startupReady: "جاهزية البداية", complete: "مكتملة", configuring: "قيد التهيئة", completeHelp: "لن يظهر تذكير البداية في الصفحات.", incompleteHelp: "أكمل الخطوات أو افتح الجولة لاحقاً من المساعدة/الإعدادات.", orgStages: "مراحل أول استخدام المؤسسة", orgHelp: "هذه الحالة محفوظة للمؤسسة وتُستأنف بعد تسجيل الدخول أو من جهاز آخر.", retry: "إعادة المحاولة", signInHelp: "سجّل الدخول لعرض تقدم المؤسسة المحفوظ واستئناف الخطوة التالية.", signIn: "تسجيل الدخول", loadingProgress: "جار تحميل تقدم أول تشغيل...", undo: "إلغاء إكمال", mark: "إكمال", stage: "مرحلة", defaults: "تصنيفات ووسوم افتراضية جاهزة", defaultsHelp: "استيراد اختياري وإضافي فقط — لا يكتب فوق أي نوع أو وسم موجود مسبقاً.", importTypes: "استيراد التصنيفات الافتراضية", importTags: "استيراد الوسوم الافتراضية", feedback: "ملاحظات الفحص التفاعلي", feedbackHelp: "دوّن أي تعديل مطلوب أثناء الفحص. تُحفظ الملاحظات على هذا الجهاز، ثم انسخها وأرسلها في محادثة المتابعة.", feedbackLabel: "ملاحظات الفحص التفاعلي", feedbackPlaceholder: "مثال: في خطوة إضافة مادة، أريد تبسيط حقل التصنيف…", copyNotes: "نسخ ملاحظات الفحص", copied: "تم النسخ. ألصق الملاحظات في محادثة المتابعة.", copyFailed: "تعذر النسخ تلقائيًا. انسخ النص من الحقل وأرسله في محادثة المتابعة.", security: "تنبيهات آمنة لأول تشغيل", apiError: "تعذر الوصول إلى API.", progressError: "تعذر تحميل تقدم أول تشغيل.", progressSaveError: "تعذر حفظ تقدم أول تشغيل.", notesHeading: "ملاحظات الفحص التفاعلي"
  };
  const journeySteps: Array<{ id: SetupStepId; title: string; description: string }> = locale === "en" ? [
    { id: "server", title: "Start the server", description: "Checks the API and data engine automatically." }, { id: "account", title: "Confirm sign-in", description: "Sign in when needed to resume saved setup." }, { id: "settings", title: "Review settings", description: "Test connections and review operating settings." }, { id: "ready", title: "Start working", description: "Move to the workspace after readiness is complete." }
  ] : [
    { id: "server", title: "تشغيل الخادم", description: "فحص API ومحرك البيانات تلقائياً." }, { id: "account", title: "تأكيد الدخول", description: "سجّل الدخول عند الحاجة لاستئناف التهيئة المحفوظة." }, { id: "settings", title: "مراجعة الإعدادات", description: "اختبار الاتصالات ومراجعة إعدادات التشغيل." }, { id: "ready", title: "بدء العمل", description: "الانتقال إلى مساحة العمل بعد اكتمال الجاهزية." }
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
        setHealth({ status: "error", message: response.error || copy.apiError });
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
        message: error instanceof Error ? error.message : copy.apiError
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
        setProgressState({ status: "error", message: response.error || copy.progressError });
        return;
      }
      setProgressState({ status: "ready", progress: response.progress });
    } catch (error) {
      setProgressState({
        status: "error",
        message: error instanceof Error ? error.message : copy.progressError
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
        setProgressState({ status: "error", message: response.error || copy.progressSaveError });
        return;
      }
      setProgressState({ status: "ready", progress: response.progress });
    } catch (error) {
      setProgressState({
        status: "error",
        message: error instanceof Error ? error.message : copy.progressSaveError
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
      await navigator.clipboard.writeText(`${copy.notesHeading}\n${note}`);
      setFeedbackStatus(copy.copied);
    } catch {
      setFeedbackStatus(copy.copyFailed);
    }
  }

  return (
    <AppShell subtitle={copy.subtitle} navLabel={copy.navLabel} contentClassName="first-run-content" tipsPage="first-run">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={(
          <>
            <span className="badge">setup.bat</span>
            <span className="badge">Control Center</span>
            <span className="badge">{completedCount}/5 {copy.stages}</span>
            <span className="badge">{copy.readiness} {journey.readinessPercentage}%</span>
          </>
        )}
        actions={(
          <>
            <button type="button" className="button button-secondary" onClick={() => void checkHealth()}>
              <RefreshCw aria-hidden="true" size={16} />
              {copy.healthCheck}
            </button>
            <FirstRunTour />
            <a className="button button-secondary" href="/help">{copy.help}</a>
            {auth.status === "authenticated" ? <a className="button button-primary" href="/">{copy.openWorkspace}</a> : null}
          </>
        )}
      />

      <div className="first-run-workspace-grid">
      <section className="panel first-run-journey" aria-label={copy.journey} aria-live="polite">
        <div className="panel-section-header helper-row">
          <div>
            <h2>{copy.journey}</h2>
            <p>{copy.currentStep}: {journeySteps.find((step) => step.id === journey.currentStep)?.title}</p>
          </div>
          <a className="button button-primary" href={journey.nextAction.href}>{journey.nextAction.label}</a>
        </div>
        <progress max={100} value={journey.readinessPercentage} aria-label={`${copy.readinessLabel} ${journey.readinessPercentage}%`} />
        <label className="checklist-control">
          <input
            type="checkbox"
            checked={expertSkip}
            onChange={(event) => toggleExpertSkip(event.target.checked)}
          />
          <span>{copy.skip}</span>
        </label>
        <p className="helper-text">{copy.skipHelp}</p>
        <ol className="first-run-steps">
          {journeySteps.map((step, index) => (
            <li key={step.id} className="first-run-step" data-complete={journey.completedSteps.includes(step.id) ? "true" : "false"}>
              <div className="first-run-step__body">
                <span className="badge">{copy.step} {index + 1}</span>
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
            <h2 id="preset-heading">{copy.choose}</h2>
            <p>{copy.setupHelp}</p>
          </div>
          <div className="view-switcher" role="group" aria-label={copy.presetLabel}>
            {(Object.keys(presets) as OnboardingPreset[]).map((key) => (
              <button
                key={key}
                type="button"
                className="view-switcher__button"
                aria-pressed={preset === key}
                onClick={() => changePreset(key)}
              >
                {presets[key].label}
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
          <ol className="first-run-steps" aria-label={copy.selectedSteps}>
            {currentPreset.steps.map((step, index) => (
              <li className="first-run-step" key={step.id}>
                <div className="first-run-step__body">
                  <span className="badge">{copy.step} {index + 1}</span>
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
              <span id="health-heading">{copy.server}</span>
              <strong>
                {health.status === "ready"
                  ? copy.connected
                  : health.status === "loading"
                    ? copy.checking
                    : health.status === "error"
                      ? copy.offline
                      : copy.notChecked}
              </strong>
              <small>
                {health.status === "ready"
                  ? `${health.backend} · ${health.engine} · ${formatUptime(health.uptimeSec, locale)}`
                  : health.status === "error"
                    ? health.message
                    : copy.startHealth}
              </small>
            </div>
          </article>

          <article className="health-metric" data-tone={isComplete ? "success" : "warning"}>
            <div className="health-metric__icon">
              <ShieldCheck aria-hidden="true" size={20} />
            </div>
            <div className="health-metric__body">
              <span>{copy.startupReady}</span>
              <strong>{isComplete ? copy.complete : copy.configuring}</strong>
              <small>{isComplete ? copy.completeHelp : copy.incompleteHelp}</small>
            </div>
          </article>
        </div>
      </section>

      <section className="page-section first-run-progress" aria-labelledby="steps-heading">
        <article className="panel">
          <div className="panel-section-header helper-row">
            <div>
              <h2 id="steps-heading">{copy.orgStages}</h2>
              <p>{copy.orgHelp}</p>
            </div>
            {progressState.status === "error" ? (
              <button type="button" className="button button-secondary button-sm" onClick={() => void loadProgress()}>
                <RefreshCw aria-hidden="true" size={15} />
                {copy.retry}
              </button>
            ) : null}
          </div>

          {auth.status === "guest" ? (
            <p className="helper-text">{copy.signInHelp}</p>
          ) : null}
          {auth.status === "guest" ? <a className="button button-primary button-sm" href="/login?next=%2Ffirst-run">{copy.signIn}</a> : null}
          {auth.status !== "guest" && progressState.status !== "ready" ? (
            <p className="helper-text" role="status">{progressState.status === "error" ? progressState.message : copy.loadingProgress}</p>
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
                      aria-label={`${step.completed ? copy.undo : copy.mark} ${step.title}`}
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
                    <span className="badge">{copy.stage} {index + 1}</span>
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
              <h2 id="defaults-heading">{copy.defaults}</h2>
              <p>{copy.defaultsHelp}</p>
            </div>
            <div className="first-run-command">
              <a className="button button-secondary" href="/types">{copy.importTypes}</a>
              <a className="button button-secondary" href="/vocabulary">{copy.importTags}</a>
            </div>
          </article>
        </section>
      ) : null}

      <section className="page-section first-run-feedback" aria-labelledby="interactive-test-feedback-heading">
        <article className="panel stack">
          <div className="panel-section-header">
            <h2 id="interactive-test-feedback-heading">{copy.feedback}</h2>
            <p>{copy.feedbackHelp}</p>
          </div>
          <textarea
            value={interactiveTestFeedback}
            onChange={(event) => updateInteractiveTestFeedback(event.target.value)}
            aria-label={copy.feedbackLabel}
            placeholder={copy.feedbackPlaceholder}
            rows={5}
          />
          <div className="button-row">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => void copyInteractiveTestFeedback()}
              disabled={!interactiveTestFeedback.trim()}
            >
              {copy.copyNotes}
            </button>
            {feedbackStatus ? <p className="helper-text" role="status">{feedbackStatus}</p> : null}
          </div>
        </article>
      </section>

      <section className="page-section first-run-security" aria-labelledby="security-heading">
        <article className="panel">
          <div className="panel-section-header">
            <h2 id="security-heading">{copy.security}</h2>
          </div>
          <ul className="checklist">
            {checklist.map((item) => (
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
