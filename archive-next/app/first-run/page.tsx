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

function formatUptime(seconds: number, copy: { unknown: string; seconds: string; minutes: string; hoursAndMinutes: string }) {
  if (!Number.isFinite(seconds) || seconds < 0) return copy.unknown;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return copy.seconds.replace("{count}", String(Math.floor(seconds)));
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return copy.minutes.replace("{count}", String(minutes));
  return copy.hoursAndMinutes.replace("{hours}", String(hours)).replace("{minutes}", String(minutes % 60));
}

export default function FirstRunPage() {
  const { locale, t } = useLocale();
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
  const copy = t.pages.firstRun;
  const title = copy.title.replace("{brand}", locale === "en" ? BRAND.latinName : BRAND.arabicName);
  const journeySteps: Array<{ id: SetupStepId; title: string; description: string }> = [
    { id: "server", ...copy.journeySteps.server },
    { id: "account", ...copy.journeySteps.account },
    { id: "settings", ...copy.journeySteps.settings },
    { id: "ready", ...copy.journeySteps.ready }
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
    // A session change is the only reason to reload; the client is stable on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status]);

  useEffect(() => {
    void checkHealth();
    // The health check runs once when the journey opens; the recheck button remains available.
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
        title={title}
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
                  ? `${health.backend} · ${health.engine} · ${formatUptime(health.uptimeSec, copy.uptime)}`
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
