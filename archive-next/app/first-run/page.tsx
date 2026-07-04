"use client";

import { CheckCircle2, Circle, Copy, ExternalLink, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { BRAND } from "@/lib/brand";
import { createArchiveApiClient } from "@/lib/archive-api";
import {
  ONBOARDING_PRESET_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
  onboardingChecklist,
  onboardingPresets,
  type OnboardingPreset
} from "@/lib/onboarding";

type HealthState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; backend: string; engine: string; uptimeSec: number }
  | { status: "error"; message: string };

type DoneMap = Record<string, boolean>;

function formatUptime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "غير معروف";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `${Math.floor(seconds)} ثانية`;
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes} دقيقة`;
  return `${hours} ساعة و${minutes % 60} دقيقة`;
}

function readDoneMap(preset: OnboardingPreset): DoneMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`${ONBOARDING_STORAGE_KEY}:${preset}`);
    return raw ? JSON.parse(raw) as DoneMap : {};
  } catch {
    return {};
  }
}

export default function FirstRunPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [preset, setPreset] = useState<OnboardingPreset>("quick");
  const [done, setDone] = useState<DoneMap>({});
  const [health, setHealth] = useState<HealthState>({ status: "idle" });
  const currentPreset = onboardingPresets[preset];
  const completedCount = currentPreset.steps.filter((step) => done[step.id]).length;
  const isComplete = completedCount === currentPreset.steps.length;

  useEffect(() => {
    const storedPreset = window.localStorage.getItem(ONBOARDING_PRESET_STORAGE_KEY);
    const nextPreset = storedPreset === "advanced" ? "advanced" : "quick";
    setPreset(nextPreset);
    setDone(readDoneMap(nextPreset));
  }, []);

  useEffect(() => {
    setDone(readDoneMap(preset));
  }, [preset]);

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

  function changePreset(nextPreset: OnboardingPreset) {
    setPreset(nextPreset);
    window.localStorage.setItem(ONBOARDING_PRESET_STORAGE_KEY, nextPreset);
    setDone(readDoneMap(nextPreset));
  }

  function toggleStep(stepId: string) {
    setDone((current) => {
      const next = { ...current, [stepId]: !current[stepId] };
      window.localStorage.setItem(`${ONBOARDING_STORAGE_KEY}:${preset}`, JSON.stringify(next));
      return next;
    });
  }

  function markComplete() {
    const next = Object.fromEntries(currentPreset.steps.map((step) => [step.id, true]));
    window.localStorage.setItem(`${ONBOARDING_STORAGE_KEY}:${preset}`, JSON.stringify(next));
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "complete");
    setDone(next);
  }

  return (
    <AppShell subtitle="أول تشغيل" navLabel="مسار التهيئة" contentClassName="first-run-content">
      <PageToolbar
        eyebrow={<span className="badge">First-run</span>}
        title={`تهيئة ${BRAND.arabicName}`}
        description="مسار عملي لأول تشغيل: اختر تهيئة سريعة أو متقدمة، نفذ أوامر Control Center بأمان، ثم تحقق من صحة Laravel + Next قبل بدء الاستخدام اليومي."
        meta={(
          <>
            <span className="badge">setup.bat</span>
            <span className="badge">Control Center</span>
            <span className="badge">{completedCount}/{currentPreset.steps.length} مكتملة</span>
          </>
        )}
        actions={(
          <>
            <button type="button" className="button button-secondary" onClick={() => void checkHealth()}>
              <RefreshCw aria-hidden="true" size={16} />
              فحص الصحة
            </button>
            <a className="button button-secondary" href="/help">المساعدة</a>
            <a className="button button-primary" href="/login">تسجيل الدخول</a>
          </>
        )}
      />

      <section className="page-section" aria-labelledby="preset-heading">
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
        </div>
      </section>

      <section className="page-section" aria-labelledby="health-heading">
        <div className="dense-grid">
          <article className="health-metric" data-tone={health.status === "ready" ? "success" : health.status === "error" ? "danger" : "accent"}>
            <div className="health-metric__icon">
              <Server aria-hidden="true" size={20} />
            </div>
            <div className="health-metric__body">
              <span id="health-heading">Laravel API</span>
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

      <section className="page-section" aria-labelledby="steps-heading">
        <article className="panel">
          <div className="panel-section-header helper-row">
            <div>
              <h2 id="steps-heading">خطوات {currentPreset.label}</h2>
              <p>ضع علامة على كل خطوة بعد تنفيذها. الحفظ محلي للمتصفح ولا يرسل أسراراً إلى API.</p>
            </div>
            <button type="button" className="button button-secondary button-sm" onClick={markComplete}>
              اعتبارها مكتملة
            </button>
          </div>

          <ol className="first-run-steps">
            {currentPreset.steps.map((step, index) => (
              <li key={step.id} className="first-run-step" data-complete={done[step.id] ? "true" : "false"}>
                <button
                  type="button"
                  className="first-run-step__toggle"
                  onClick={() => toggleStep(step.id)}
                  aria-pressed={done[step.id] ? "true" : "false"}
                  aria-label={`${done[step.id] ? "إلغاء إكمال" : "إكمال"} ${step.title}`}
                >
                  {done[step.id] ? <CheckCircle2 aria-hidden="true" size={20} /> : <Circle aria-hidden="true" size={20} />}
                </button>
                <div className="first-run-step__body">
                  <span className="badge">خطوة {index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  {step.command ? (
                    <div className="first-run-command">
                      <code dir="ltr">{step.command}</code>
                      <button
                        type="button"
                        className="button button-secondary button-sm"
                        onClick={() => void navigator.clipboard?.writeText(step.command || "")}
                      >
                        <Copy aria-hidden="true" size={15} />
                        نسخ
                      </button>
                    </div>
                  ) : null}
                  {step.href ? (
                    <a className="button button-secondary button-sm" href={step.href}>
                      {step.actionLabel || "فتح"}
                      <ExternalLink aria-hidden="true" size={15} />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="page-section" aria-labelledby="security-heading">
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
    </AppShell>
  );
}
