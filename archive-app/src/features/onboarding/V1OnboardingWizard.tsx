import {
  handleAppError
} from "../../utils/errorHandling.js";
import {
  useTheme
} from "../../theme/useTheme.js";
import {
  useAppStore,
  useAuthStore
} from "../../stores/index.js";
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Database,
  FileDown,
  FileUp,
  Flame,
  HardDrive,
  Keyboard,
  LayoutGrid,
  Laptop,
  ScrollText,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Video,
  X
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  CORE_UI_TOUR_ITEMS,
  ONBOARDING_ACCENT_OPTIONS,
  ONBOARDING_DATA_TOPICS,
  ONBOARDING_SERVER_UPDATE_OPTIONS,
  ONBOARDING_SHORTCUTS,
  ONBOARDING_STEPS,
  ONBOARDING_STORAGE_OPTIONS,
  ONBOARDING_THEME_OPTIONS
} from "./flow.js";
import {
  createOnboardingCompletionPatch,
  normalizeOnboardingAccentChoice,
  normalizeOnboardingServerUpdatePolicy,
  normalizeOnboardingSecurityMode,
  normalizeOnboardingThemeChoice
} from "./viewModel.js";
import {
  getBackendChoice,
  getFirebaseConfig,
  getBackendUrl,
  getLocalEngine,
  normalizeBackendChoice,
  setBackendChoice,
  shouldForceLocalBackend
} from "../../bootstrap/backendChoice.js";
import { parseFirebaseConfigText, stringifyFirebaseConfig } from "../../bootstrap/firebaseConfig.js";
import { getCloudToken, loginToCloud } from "../../bootstrap/cloudSession.js";
import { PasswordField } from "../../components/common/PasswordField.jsx";
import { RoleSelectionStep } from "../../components/onboarding/RoleSelectionStep.jsx";
import {
  DATABASE_ENGINES,
  DATABASE_ENGINE_LABELS,
  buildDatabaseUrl,
  normalizeDatabaseEngine,
  testDbConnection
} from "../settings/dbConfigClient.js";
import { fetchServerHealth } from "../server-status/serverHealthClient.js";
import { validatePasswordStrength } from "../../utils/passwordHash.js";
import { applyAccentColor } from "../../theme/accentColor.js";
import { PresetConfigScreen } from "./PresetConfigScreen.jsx";
import { FileStoreSetupStep } from "./FileStoreSetupStep.jsx";
import {
  DEFAULT_FILE_STORE_PROVIDERS,
  createPresetFormState,
  selectBackendPreset
} from "./presetModel.js";
import { normalizeRoleProfileId } from "./roleProfiles.js";
import { seedDemoData } from "./DemoModeSeeder.js";

const STORAGE_ICONS = { local: Laptop, postgres: Server, pocketbase: Cloud, firebase: Flame };
const DEFAULT_PORT_BY_ENGINE = { postgresql: "5432", mysql: "3306", sqlserver: "1433" };

const FIRST_TASK_OPTIONS = [
  { id: "dashboard", label: "مركز التحكم", detail: "ابدأ من جاهزية اليوم والإجراءات السريعة.", icon: LayoutGrid },
  { id: "add-video", label: "إضافة فيديو", detail: "افتح نموذج الإضافة مباشرة بعد الدخول.", icon: Video },
  { id: "import-backup", label: "استيراد أو نقل", detail: "ابدأ من مركز البيانات لاستيراد نسخة أو ملف نقل.", icon: HardDrive },
  { id: "create-type", label: "إنشاء نوع", detail: "جهز أول نوع محتوى وحقوله قبل الأرشفة.", icon: Database }
];

const EXTRA_STEPS = [
  ...ONBOARDING_STEPS.flatMap((step: any) => step.id === "security"
    ? [step, { id: "role", label: "نمط الاستخدام", detail: "تخصيص المسارات المبرزة حسب طريقة عملك.", tier: "advanced" }]
    : [step]
  ),
  { id: "first-task", label: "البداية", detail: "اختيار أول شاشة بعد الإعداد.", tier: "basic" }
];

function normalizeAdvancedSetupMode(value: any) {
  return value === "advanced" ? "advanced" : "basic";
}

const arabicNumber = new Intl.NumberFormat("ar");

function formatStepCount(current: any, total: any) {
  return `${arabicNumber.format(current)} / ${arabicNumber.format(total)}`;
}

function getInitialStepId(savedStepId: any, steps: any) {
  if (steps.some((step: any) => step.id === savedStepId)) return savedStepId;
  return steps[0]?.id || "welcome";
}

function isInteractiveTarget(target: any) {
  return Boolean(target?.closest?.("button,a,input,textarea,select,[contenteditable='true']"));
}

function OnboardingProgressRail({ steps, activeStepIndex, onStepClick }: any) {
  const activeStep = steps[activeStepIndex] || steps[0];
  return jsxs("nav", {
    className: "va-onboarding-progress rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.035] px-4 py-3",
    "aria-label": "تقدم معالج البداية",
    children: [
      jsxs("div", {
        className: "flex flex-wrap items-center justify-between gap-3",
        children: [
          jsxs("div", {
            className: "min-w-0",
            children: [
              jsx("p", {
                className: "text-xs font-semibold va-accent-text",
                "aria-live": "polite",
                children: `الخطوة ${formatStepCount(activeStepIndex + 1, steps.length)}`
              }),
              jsx("p", {
                className: "mt-1 truncate text-sm font-semibold text-[var(--va-text)]",
                children: activeStep?.label || "البدء"
              })
            ]
          }),
          jsx("div", {
            className: "flex flex-wrap items-center justify-start gap-1.5",
            children: steps.map((step: any, index: any) => {
              const active = index === activeStepIndex;
              const completed = index < activeStepIndex;
              const reachable = index <= activeStepIndex;
              return jsx("button", {
                type: "button",
                disabled: !reachable,
                onClick: () => reachable && onStepClick(index),
                "aria-current": active ? "step" : undefined,
                className: [
                  "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-200",
                  active
                    ? "va-accent-bg text-[var(--va-text)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--va-accent-500,var(--va-action))_30%,transparent),0_0_16px_color-mix(in_oklch,var(--va-accent-500,var(--va-action))_40%,transparent)]"
                    : completed
                    ? "va-accent-bg-soft va-accent-text hover:bg-opacity-80"
                    : "bg-[var(--va-surface-2)] text-[var(--va-text-muted)] cursor-not-allowed"
                ].join(" "),
                children: [
                  completed
                    ? jsx(Check, { className: "h-3.5 w-3.5", strokeWidth: 3 })
                    : jsx("span", { children: String(index + 1) }),
                  jsx("span", { className: "sr-only", children: `${reachable ? "الانتقال إلى" : "خطوة لاحقة"} ${step.label}` })
                ]
              }, step.id);
            })
          })
        ]
      }),
      jsx("div", {
        className: "mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--va-surface-2)]",
        dir: "rtl",
        "aria-hidden": "true",
        children: jsx("div", {
          className: "h-full rounded-full va-accent-bg transition-all duration-300",
          style: { width: `${((activeStepIndex + 1) / Math.max(steps.length, 1)) * 100}%` }
        })
      })
    ]
  });
}

function getPasswordStrength(password: any = "") {
  const value = String(password || "");
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^a-zA-Z0-9]/.test(value)) score += 1;
  const labels = ["ضعيفة", "مقبولة", "جيدة", "قوية", "قوية جداً"];
  const colors = ["#f87171", "#f59e0b", "#14b8a6", "#10b981", "#22c55e"];
  return { score, label: labels[score] || labels[0], color: colors[score] || colors[0] };
}

function FieldLabel({ children }: any) {
  return jsx("label", {
    className: "block text-sm font-medium text-[var(--va-text-2)]",
    children
  });
}

function OptionButton({ active, children, onClick }: any) {
  return jsx("button", {
    type: "button",
    onClick,
    "aria-pressed": active,
    className: `btn btn-ghost h-full min-h-[88px] w-full rounded-2xl p-4 text-right transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] ${
      active
        ? "va-accent-border va-accent-bg-soft text-[var(--va-text)]"
        : "border-[var(--va-border-soft)] bg-white/[0.035] text-[var(--va-text-2)] hover:border-[var(--va-border-soft)] hover:bg-white/[0.06]"
    }`,
    style: active ? {
      boxShadow: "0 0 0 2px var(--va-accent-500, var(--va-action)), 0 4px 12px color-mix(in oklch, var(--va-accent-500, var(--va-action)) 20%, transparent)"
    } : {},
    children
  });
}

function PrimaryButton({ children, onClick, disabled = false, type = "button" }: any) {
  return jsx("button", {
    type,
    onClick,
    disabled,
    className: "btn btn-primary",
    children
  });
}

function SecondaryButton({ children, onClick, disabled = false }: any) {
  return jsx("button", {
    type: "button",
    onClick,
    disabled,
    className: "btn btn-ghost",
    children
  });
}

export function V1OnboardingWizard({ open, mode = "startup", onComplete, onCancel }: any) {
  const replayMode = mode === "replay";
  const {
    settings,
    isPasswordSet,
    setMasterPassword,
    skipPasswordSetup,
    updateSettings,
    showToast,
    addVideoItem
  } = useAppStore();
  const authStore = useAuthStore();
  const { setTheme } = useTheme();
  const [advancedSetupMode, setAdvancedSetupMode] = React.useState(() => normalizeAdvancedSetupMode(settings.ui?.advancedSetupMode || "basic"));
  const [securityMode, setSecurityMode] = React.useState(() => {
    // In Simple mode we force "secure" so the admin step is always present
    // and the wizard's 3-step promise (storage → admin → first-task) holds.
    if (!settings.ui?.advancedSetupMode || settings.ui.advancedSetupMode === "basic") return "secure";
    return normalizeOnboardingSecurityMode(settings.ui?.onboardingSecurityMode || "secure");
  });
  const [themeChoice, setThemeChoice] = React.useState(() => normalizeOnboardingThemeChoice(settings.ui?.onboardingThemeChoice || settings.theme || "dark"));
  const [accentColor, setAccentColor] = React.useState(() => normalizeOnboardingAccentChoice(settings.accentColor || "teal"));
  const [visualDensity, setVisualDensity] = React.useState(settings.ui?.visualDensity === "compact" ? "compact" : "comfortable");
  const [roleProfile, setRoleProfile] = React.useState(() => normalizeRoleProfileId(settings.ui?.roleProfile || "editor"));
  const [firstTaskChoice, setFirstTaskChoice] = React.useState(settings.ui?.firstTaskChoice || "dashboard");
  const [serverUpdatePolicy, setServerUpdatePolicy] = React.useState(() => normalizeOnboardingServerUpdatePolicy(settings.ui?.serverUpdatePolicy || "stable"));
  // Backend choice is read from localStorage (set by a previous run) so the
  // wizard reflects the current wiring; defaults to "local" on first run.
  const [storageChoice, setStorageChoice] = React.useState(() => getBackendChoice());
  const [storageUrl, setStorageUrl] = React.useState(() => getBackendUrl());
  const [localEngine, setLocalEngine] = React.useState(() => getLocalEngine());
  const [firebaseConfigText, setFirebaseConfigText] = React.useState(() => stringifyFirebaseConfig(getFirebaseConfig() || {}));
  const [serverEngine, setServerEngine] = React.useState("postgresql");
  const [serverDbUrl, setServerDbUrl] = React.useState("");
  const [serverDbParts, setServerDbParts] = React.useState({ host: "", port: "5432", database: "archive", user: "archive", password: "", file: "./archive.sqlite" });
  const [cloudUsername, setCloudUsername] = React.useState("admin");
  const [cloudPassword, setCloudPassword] = React.useState("");
  const [fileStoreChoice, setFileStoreChoice] = React.useState("disk");
  const [fileStoreTest, setFileStoreTest] = React.useState<any>(null);
  const [fileStoreTesting, setFileStoreTesting] = React.useState(false);
  const [storageTest, setStorageTest] = React.useState<any>(null);
  const [storageTesting, setStorageTesting] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // AI Studio sandboxes the SPA in an iframe that can't reach a user-owned
  // server, but client-side local and Firebase remain valid choices.
  const forceLocal = shouldForceLocalBackend();
  const availableStorageOptions = React.useMemo(() => forceLocal
    ? ONBOARDING_STORAGE_OPTIONS.filter((option: any) => option.id === "local" || option.id === "firebase")
    : ONBOARDING_STORAGE_OPTIONS
  , [forceLocal]);

  const steps = React.useMemo(() => {
    let list = EXTRA_STEPS;
    if (!replayMode && securityMode === "quick") list = list.filter((step: any) => step.id !== "admin");
    if (storageChoice !== "postgres" && storageChoice !== "pocketbase") list = list.filter((step: any) => step.id !== "file-store");
    if (!replayMode && advancedSetupMode === "basic") list = list.filter((step: any) => step.tier !== "advanced");
    return list;
  }, [advancedSetupMode, replayMode, securityMode, storageChoice]);
  const [stepId, setStepId] = React.useState(settings.ui?.lastOnboardingStep && EXTRA_STEPS.some((step: any) => step.id === settings.ui.lastOnboardingStep) ? settings.ui.lastOnboardingStep : "welcome");
  const [presetConfig, setPresetConfig] = React.useState(null);
  const [showPresetScreen, setShowPresetScreen] = React.useState(false);

  React.useEffect(() => {
    if (mode !== "startup" || replayMode) return;
    fetch("/api/setup/preset-config")
      .then((r: any) => r.ok ? r.json() : null)
      .then((data: any) => {
        if (!data?.ok || !data.config) return;
        const form = createPresetFormState(data.config);
        setPresetConfig(data.config);
        setStorageChoice(form.storageChoice);
        setStorageUrl(form.storageUrl);
        setCloudUsername(form.cloudUsername);
        setCloudPassword(form.cloudPassword);
        setFileStoreChoice(form.fileStoreChoice);
        setShowPresetScreen(false);
      })
      .catch(() => undefined);
  }, [mode, replayMode]);
  const activeStepIndex = Math.max(0, steps.findIndex((step: any) => step.id === stepId));
  const activeStep = steps[activeStepIndex] || steps[0];
  const passwordStrength = getPasswordStrength(password);
  const passwordMatches = password.length > 0 && password === confirmPassword;
  // Gate on the SAME policy setMasterPassword enforces (letter + digit +
  // symbol + length >= 8). Previously the wizard accepted score >= 2 (symbol
  // optional), so a password the wizard accepted could be silently rejected
  // by setMasterPassword — leaving the admin without a usable password and
  // breaking login.
  const passwordPolicyErrors = validatePasswordStrength(password);
  const canContinueAdmin = replayMode || securityMode === "quick" || (passwordMatches && passwordPolicyErrors.length === 0);

  // A cloud backend needs a URL before we let the user move on. Local needs
  // nothing. A loose http(s) check keeps the error helpful without being a
  // full URL parser.
  const selectedStorageOption = availableStorageOptions.find((option: any) => option.id === storageChoice);
  const storageUsesServer = storageChoice === "postgres" || storageChoice === "pocketbase";
  const storageAllowsSameOrigin = Boolean(selectedStorageOption?.allowsSameOrigin);
  const storageUrlValid = !storageUsesServer
    || (storageAllowsSameOrigin && !storageUrl.trim())
    || /^https?:\/\/.+/i.test(storageUrl.trim());
  const firebaseConfigState = React.useMemo(() => parseFirebaseConfigText(firebaseConfigText), [firebaseConfigText]);
  const canContinueStorage = storageChoice === "firebase" ? firebaseConfigState.ok : storageUrlValid;
  const fileStoreProviders = (presetConfig as any)?.fileStore?.providers?.length
    ? (presetConfig as any).fileStore.providers
    : DEFAULT_FILE_STORE_PROVIDERS;
  React.useEffect(() => {
    if (!availableStorageOptions.some((option: any) => option.id === storageChoice)) {
      setStorageChoice("local");
    }
  }, [availableStorageOptions, storageChoice]);
  const storageDbCandidateUrl = React.useCallback(() => {
    if (serverDbUrl.trim()) return serverDbUrl.trim();
    return buildDatabaseUrl({
      ...serverDbParts,
      engine: serverEngine,
      port: Number(serverDbParts.port) || (DEFAULT_PORT_BY_ENGINE as any)[serverEngine]
    } as any);
  }, [serverDbParts, serverDbUrl, serverEngine]);
  const setServerDbPart = (key: any, value: any) => setServerDbParts((parts: any) => ({ ...parts, [key]: value }));
  const changeServerEngine = (next: any) => {
    const normalized = normalizeDatabaseEngine(next);
    setServerEngine(normalized);
    setServerDbParts((parts: any) => ({ ...parts, port: (DEFAULT_PORT_BY_ENGINE as any)[normalized] || parts.port, file: parts.file || "./archive.sqlite" }));
  };
  const runStorageConnectionTest = async () => {
    setStorageTest(null);
    if (storageChoice === "local") {
      setStorageTest({ ok: true, text: localEngine === "sqlite" ? "سيُستخدم SQLite المحلي عبر OPFS عند توفره، مع تراجع آمن إلى IndexedDB." : "الوضع المحلي جاهز عبر IndexedDB." });
      return;
    }
    if (storageChoice === "firebase") {
      setStorageTest({
        ok: firebaseConfigState.ok,
        text: firebaseConfigState.ok
          ? "تهيئة Firebase صالحة. سيتم تحميل Firestore/Auth/Storage عند التفعيل."
          : `حقول Firebase مطلوبة: ${firebaseConfigState.errors.join(", ")}`
      });
      return;
    }
    if (!storageUrlValid) {
      setStorageTest({ ok: false, text: "أدخل عنوان خادم صحيحاً أولاً." });
      return;
    }
    setStorageTesting(true);
    try {
      if (cloudUsername.trim() && cloudPassword) {
        await loginToCloud({ baseUrl: storageUrl.trim(), username: cloudUsername.trim(), password: cloudPassword });
      }
      const health = await fetchServerHealth({ baseUrl: storageUrl.trim() });
      if (storageChoice === "postgres" && serverDbUrl.trim()) {
        const db = await testDbConnection({
          engine: serverEngine,
          url: storageDbCandidateUrl(),
          baseUrl: storageUrl.trim(),
          getToken: getCloudToken
        } as any);
        setStorageTest({
          ok: db.ok !== false && health?.ok !== false,
          text: db.ok === false ? db.error || "فشل اختبار قاعدة البيانات." : "نجح فحص الخادم واختبار إعداد قاعدة البيانات."
        });
      } else {
        setStorageTest({ ok: health?.db?.ok !== false, text: health?.db?.ok === false ? health.db.error || "الخادم يعمل لكن قاعدة البيانات متدهورة." : "الخادم متاح وحالة قاعدة البيانات مقروءة." });
      }
    } catch (error: any) {
      setStorageTest({ ok: false, text: error?.message || "فشل اختبار الاتصال." });
    } finally {
      setStorageTesting(false);
    }
  };
  const runFileStoreConnectionTest = async (kind: any = fileStoreChoice) => {
    setFileStoreTesting(true);
    setFileStoreTest(null);
    try {
      const provider = fileStoreProviders.find((item: any) => item.id === kind);
      if (!provider?.configured) {
        const missing = provider?.missingEnv?.length ? `: ${provider.missingEnv.join(", ")}` : "";
        setFileStoreTest({ ok: false, text: `المزود غير مكتمل الإعداد${missing}` });
        return;
      }
      setFileStoreTest({
        ok: true,
        text: provider?.active
          ? "المخزن النشط مهيأ. سيجري اختبار القراءة والكتابة الحي بعد تسجيل الدخول."
          : "إعداد المزود مكتمل وسيُحفظ للتفعيل بعد إعادة تشغيل الخادم."
      });
    } finally {
      setFileStoreTesting(false);
    }
  };
  const prefersReducedMotion = useReducedMotion();
  const shellRef = React.useRef(null);
  const slideRef = React.useRef(null);
  const initializedRef = React.useRef(false);
  const pointerStartXRef = React.useRef(null);
  const [slideDirection, setSlideDirection] = React.useState("next");
  const isFirstStep = activeStepIndex <= 0;
  const isLastStep = activeStepIndex >= steps.length - 1;
  const activeSlideTitleId = `onboarding-slide-title-${activeStep?.id || "welcome"}`;

  const canLeaveCurrentStep = React.useCallback(() => {
    if (activeStep?.id === "admin" && !canContinueAdmin) {
      setError("أدخل كلمة مرور قوية ومتطابقة قبل المتابعة.");
      return false;
    }
    if (activeStep?.id === "storage" && !canContinueStorage) {
      setError(storageChoice === "firebase"
        ? "ألصق firebaseConfig صالحاً يحتوي apiKey وprojectId وappId قبل المتابعة."
        : "أدخل عنوان خادم صحيح يبدأ بـ http:// أو https:// قبل المتابعة.");
      return false;
    }
    return true;
  }, [activeStep?.id, canContinueAdmin, canContinueStorage, storageChoice]);

  const persistStepProgress = React.useCallback((nextStepId: any) => {
    if (replayMode || !nextStepId) return;
    updateSettings?.({
      ui: {
        ...(settings.ui || {}),
        lastOnboardingStep: nextStepId,
        onboardingSecurityMode: securityMode,
        onboardingThemeChoice: themeChoice,
        roleProfile,
        firstTaskChoice,
        serverUpdatePolicy,
        advancedSetupMode
      }
    });
  }, [advancedSetupMode, firstTaskChoice, replayMode, roleProfile, securityMode, serverUpdatePolicy, settings.ui, themeChoice, updateSettings]);

  const toggleAdvancedSetupMode = React.useCallback(() => {
    setAdvancedSetupMode((current: any) => {
      const next = current === "advanced" ? "basic" : "advanced";
      // Flipping back to Simple forces "secure" so the admin step survives the
      // tier filter — otherwise basic would shrink to just storage + first-task.
      if (next === "basic") setSecurityMode("secure");
      if (!replayMode) {
        updateSettings?.({
          ui: {
            ...(settings.ui || {}),
            advancedSetupMode: next,
            onboardingSecurityMode: next === "basic" ? "secure" : securityMode
          }
        });
      }
      return next;
    });
  }, [replayMode, securityMode, settings.ui, updateSettings]);

  const moveToStepIndex = React.useCallback((nextIndex: any, direction: any = "next", { validate = true }: any = {}) => {
    const boundedIndex = Math.max(0, Math.min(steps.length - 1, nextIndex));
    const nextStep = steps[boundedIndex];
    if (!nextStep || nextStep.id === activeStep?.id) return;
    if (validate && boundedIndex > activeStepIndex && !canLeaveCurrentStep()) return;
    setError("");
    setSlideDirection(direction);
    setStepId(nextStep.id);
    persistStepProgress(nextStep.id);
  }, [activeStep?.id, activeStepIndex, canLeaveCurrentStep, persistStepProgress, steps]);

  const goNext = React.useCallback(() => {
    if (isLastStep) return;
    moveToStepIndex(activeStepIndex + 1, "next");
  }, [activeStepIndex, isLastStep, moveToStepIndex]);

  const goBack = React.useCallback(() => {
    if (isFirstStep) return;
    moveToStepIndex(activeStepIndex - 1, "previous", { validate: false });
  }, [activeStepIndex, isFirstStep, moveToStepIndex]);

  React.useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;
    setError("");
    setIsSubmitting(false);
    setSlideDirection("next");
    setStepId(getInitialStepId(settings.ui?.lastOnboardingStep, steps));
  }, [mode, open, settings.ui?.lastOnboardingStep, steps]);

  React.useEffect(() => {
    if (securityMode === "quick" && stepId === "admin" && !replayMode) {
      moveToStepIndex(steps.findIndex((step: any) => step.id === "appearance"), "next", { validate: false });
    }
  }, [moveToStepIndex, replayMode, securityMode, stepId, steps]);

  React.useEffect(() => {
    if (!open) return;
    const frameId = window.requestAnimationFrame(() => {
      (shellRef.current as any)?.scrollTo?.({ top: 0, behavior: "auto" });
      (slideRef.current as any)?.focus?.({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeStep?.id, open, prefersReducedMotion]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: any) => {
      if (isInteractiveTarget(event.target)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goBack();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goNext();
      } else if (event.key === "Escape" && replayMode) {
        event.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goBack, goNext, onCancel, open, replayMode]);

  // Live accent color preview — apply immediately as the user picks a color
  React.useEffect(() => {
    applyAccentColor(accentColor);
  }, [accentColor]);

  // Live theme preview — apply immediately as the user picks a theme
  React.useEffect(() => {
    setTheme(themeChoice);
  }, [themeChoice, setTheme]);

  const handlePointerDown = (event: any) => {
    if (isInteractiveTarget(event.target)) return;
    pointerStartXRef.current = event.clientX;
  };

  const handlePointerUp = (event: any) => {
    const startX = pointerStartXRef.current;
    pointerStartXRef.current = null;
    if (typeof startX !== "number" || isInteractiveTarget(event.target)) return;
    const deltaX = event.clientX - startX;
    if (Math.abs(deltaX) < 56) return;
    if (deltaX > 0) goBack();
    if (deltaX < 0) goNext();
  };

  const openSecuritySettings = async () => {
    await updateSettings({ ui: { ...(settings.ui || {}), lastSettingsTab: "security" } });
    window.dispatchEvent(new CustomEvent("videoarchive:onboarding-close"));
    onCancel?.();
  };

  const finishWizard = async () => {
    setError("");
    if (!replayMode && securityMode === "secure" && !canContinueAdmin) {
      setError("أدخل كلمة مرور قوية ومتطابقة قبل إكمال الإعداد.");
      setSlideDirection("previous");
      setStepId("admin");
      return;
    }
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const completionPatch = createOnboardingCompletionPatch({
      securityMode,
      themeChoice,
      accentColor,
      visualDensity,
      roleProfile,
      firstTaskChoice,
      serverUpdatePolicy,
      replayMode,
      now
    });
    // Persist the storage backend choice before anything else. It lives in
    // localStorage (not settings) because the boot path reads it BEFORE the
    // store — which itself needs a backend — can load. AI Studio persists
    // only client-side choices (local/Firebase); user-owned server backends
    // are still forced back to local at boot.
    try {
      if (!forceLocal && storageUsesServer && cloudUsername.trim() && cloudPassword) {
        await loginToCloud({ baseUrl: storageUrl.trim(), username: cloudUsername.trim(), password: cloudPassword });
      }
      if (!forceLocal || storageChoice === "local" || storageChoice === "firebase") {
        setBackendChoice(
          normalizeBackendChoice(storageChoice),
          storageUsesServer ? storageUrl.trim() : "",
          {
            localEngine,
            firebaseConfig: storageChoice === "firebase" ? firebaseConfigState.config : null
          }
        );
      }
      if (!replayMode && securityMode === "secure") {
        const passwordSet = await setMasterPassword(password);
        if (!passwordSet) {
          setError("كلمة المرور لا تستوفي الشروط (8 أحرف على الأقل، مع حرف ورقم ورمز). صحّحها ثم أعد المحاولة.");
          setSlideDirection("previous");
          setStepId("admin");
          setIsSubmitting(false);
          return;
        }
      }
      await updateSettings({
        ...completionPatch,
        ui: {
          ...(completionPatch.ui || {}),
          onboardingFileStoreChoice: fileStoreChoice
        }
      });
      setTheme(themeChoice);

      if (!replayMode && securityMode === "secure") {
        const loggedIn = await authStore.login("admin", password, false);
        if (!loggedIn) {
          showToast?.("تم تأمين المدير، لكن تعذر تسجيل الدخول تلقائياً. سجّل الدخول بكلمة المرور الجديدة.", "warning");
        }
      }

      if (!replayMode && securityMode === "quick") {
        await skipPasswordSetup?.();
        const freshUsers = useAppStore.getState().users || [];
        const adminUser = freshUsers.find((user: any) => user.username === "admin" && user.isActive !== false) || freshUsers.find((user: any) => user.isActive !== false);
        if (adminUser) {
          useAuthStore.setState({ currentUser: adminUser, isAuthenticated: true, authError: null });
        }
        showToast?.("تم تفعيل البدء السريع بدون كلمة مرور. يمكنك إضافة الحماية لاحقاً من الإعدادات.", "warning");
      }

      setCloudPassword("");
      onComplete?.({ replayMode, securityMode, roleProfile, firstTaskChoice, serverUpdatePolicy, fileStoreChoice });
    } catch (errorObject: any) {
      handleAppError(errorObject, "معالج بدء التشغيل", { message: "تعذر إكمال معالج البداية" });
      setError("تعذر إكمال المعالج. راجع فحص النظام أو حاول مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInstantTry = React.useCallback(async () => {
    setIsSubmitting(true);
    try {
      await seedDemoData(addVideoItem);
      await updateSettings({ ui: { ...(settings.ui || {}), demoMode: true, onboardingCompleted: true, v1OnboardingCompleted: true } });
      onComplete?.({ replayMode: false, securityMode: "quick", roleProfile, firstTaskChoice: "dashboard", serverUpdatePolicy, instantTry: true });
    } catch (errorObject: any) {
      handleAppError(errorObject, "وضع التجربة", { message: "تعذر تهيئة بيانات التجربة" });
    } finally {
      setIsSubmitting(false);
    }
  }, [addVideoItem, firstTaskChoice, onComplete, roleProfile, serverUpdatePolicy, settings.ui, updateSettings]);

  const renderStepBody = () => {
    if (activeStep.id === "welcome") {
      return jsxs("div", { className: "space-y-5", children: [
        jsx("div", { className: "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl va-accent-bg-soft va-accent-text", children: jsx(Video, { className: "h-8 w-8" }) }),
        jsx("h1", { className: "text-2xl font-bold text-[var(--va-text)]", children: replayMode ? "معالج البداية" : "مرحباً بك في أرشيف الفيديو" }),
        jsx("p", { className: "mx-auto max-w-2xl text-sm leading-7 text-[var(--va-text-muted)]", children: replayMode ? "يمكنك مراجعة أساسيات الواجهة وتعديل تفضيلات البداية بدون تغيير كلمة المرور." : "سنجهز التطبيق بعد شاشة التحميل مباشرة: الحماية، المدير، المظهر، ثم أول شاشة تناسب عملك اليومي." }),
        jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-3", children: [
          ["محلي بالكامل", "تظل بياناتك على هذا الجهاز."],
          ["جاهز للنقل", "يمكنك التصدير لاحقاً لجهاز آخر."],
          ["RTL أولاً", "التجربة مصممة للعربية من البداية."]
        ].map(([title, detail]: any) => jsxs("div", { className: "rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.035] p-4", children: [
          jsx("p", { className: "font-semibold text-[var(--va-text)]", children: title }),
          jsx("p", { className: "mt-1 text-xs leading-6 text-[var(--va-text-muted)]", children: detail })
        ] }, title)) }),
        !replayMode && jsxs("div", { className: "flex flex-col gap-3 pt-2 sm:flex-row", children: [
          jsx("button", {
            type: "button",
            onClick: handleInstantTry,
            disabled: isSubmitting,
            className: "btn btn-primary flex-1 gap-2",
            children: isSubmitting ? "جارٍ التحضير..." : "ابدأ فوراً (تجريبي)"
          }),
          jsx("button", {
            type: "button",
            onClick: goNext,
            disabled: isSubmitting,
            className: "inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--va-border-soft)] px-5 py-2 text-sm font-semibold text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] disabled:cursor-not-allowed disabled:opacity-50",
            children: "إعداد كامل"
          })
        ] })
      ] });
    }

    if (activeStep.id === "security") {
      return jsxs("div", { className: "space-y-4", children: [
        jsx("h2", { className: "text-xl font-bold text-[var(--va-text)]", children: "اختر وضع الحماية" }),
        jsxs("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: [
          jsx(OptionButton, { active: securityMode === "secure", onClick: () => setSecurityMode("secure"), children: jsxs("div", { children: [
            jsx(ShieldCheck, { className: "mb-3 h-6 w-6 va-accent-text" }),
            jsx("p", { className: "font-semibold", children: "الإعداد الآمن" }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-[var(--va-text-muted)]", children: "تعيين كلمة مرور للمدير قبل فتح التطبيق. هذا هو الخيار الموصى به." })
          ] }) }),
          jsx(OptionButton, { active: securityMode === "quick", onClick: () => setSecurityMode("quick"), children: jsxs("div", { children: [
            jsx(Shield, { className: "mb-3 h-6 w-6 text-amber-300" }),
            jsx("p", { className: "font-semibold", children: "البدء السريع" }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-[var(--va-text-muted)]", children: "يفتح التطبيق محلياً بدون كلمة مرور. ستظهر بطاقة لاحقة لاستكمال الحماية." })
          ] }) })
        ] }),
        securityMode === "quick" && jsxs("div", { className: "flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-100", role: "status", children: [
          jsx(TriangleAlert, { className: "mt-0.5 h-5 w-5 shrink-0" }),
          jsx("p", { className: "text-sm leading-7", children: "البدء السريع مناسب للتجربة فقط. أي شخص لديه وصول للجهاز قد يفتح الأرشيف." })
        ] })
      ] });
    }

    if (activeStep.id === "admin") {
      if (replayMode) {
        return jsxs("div", { className: "space-y-4", children: [
          jsx("h2", { className: "text-xl font-bold text-[var(--va-text)]", children: "حالة المدير والحماية" }),
          jsx("p", { className: "text-sm leading-7 text-[var(--va-text-muted)]", children: isPasswordSet ? "الحماية مفعلة بالفعل. لا يغير وضع إعادة التشغيل كلمة المرور." : "الحماية غير مفعلة حالياً. يمكنك ضبطها من تبويب الأمان في الإعدادات." }),
          jsx(SecondaryButton, { onClick: openSecuritySettings, children: "فتح إعدادات الأمان" })
        ] });
      }
      return jsxs("div", { className: "space-y-4", children: [
        jsx("h2", { className: "text-xl font-bold text-[var(--va-text)]", children: "عيّن كلمة مرور المدير" }),
        jsx("p", { className: "text-sm leading-7 text-[var(--va-text-muted)]", children: "هذه الكلمة تؤمّن التطبيق وتصبح كلمة دخول حساب المدير." }),
        jsxs("div", { className: "max-w-md space-y-2", children: [
          jsx(FieldLabel, { children: "كلمة المرور" }),
          jsx(PasswordField, {
            value: password,
            autoComplete: "new-password",
            ariaLabel: "كلمة مرور المدير",
            onChange: (event: any) => {
              setPassword(event.target.value);
              setError("");
            }
          })
        ] }),
        jsxs("div", { className: "max-w-md space-y-2", children: [
          jsx(FieldLabel, { children: "تأكيد كلمة المرور" }),
          jsx(PasswordField, {
            value: confirmPassword,
            autoComplete: "new-password",
            ariaLabel: "تأكيد كلمة مرور المدير",
            onChange: (event: any) => {
              setConfirmPassword(event.target.value);
              setError("");
            }
          })
        ] }),
        jsxs("div", { className: "flex max-w-md flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.035] p-3", children: [
          jsxs("div", { children: [
            jsx("p", { className: "text-sm text-[var(--va-text-2)]", children: "قوة كلمة المرور" }),
            jsx("p", { className: "text-xs", style: { color: passwordStrength.color }, children: passwordStrength.label })
          ] }),
          jsx("div", { className: "flex min-w-32 flex-1 gap-1", dir: "rtl", children: [1, 2, 3, 4].map((level: any) => {
            const strengthPercent = (passwordStrength.score / 4) * 100;
            const fillColor = passwordStrength.score >= level
              ? (strengthPercent < 40
                  ? "#ef4444"
                  : strengthPercent < 70
                  ? "#f59e0b"
                  : "var(--va-action, #10b981)")
              : "rgba(255,255,255,0.08)";
            return jsx("span", {
              className: "h-2 flex-1 rounded-full",
              style: { backgroundColor: fillColor, transition: "background-color 0.3s ease" }
            }, level);
          }) })
        ] }),
        password.length > 0 && passwordPolicyErrors.length > 0 && jsx("p", { className: "text-xs leading-6 text-amber-300/90", children: passwordPolicyErrors[0] }),
        confirmPassword && jsx("p", { className: `text-sm ${passwordMatches ? "va-accent-text" : "text-red-300"}`, children: passwordMatches ? "كلمة المرور متطابقة" : "كلمة المرور غير متطابقة" })
      ] });
    }

    if (activeStep.id === "role") {
      return jsx(RoleSelectionStep, {
        value: roleProfile,
        onChange: setRoleProfile
      });
    }

    if (activeStep.id === "storage") {
      const selected = availableStorageOptions.find((option: any) => option.id === storageChoice) || availableStorageOptions[0];
      const selectedServerPolicy = ONBOARDING_SERVER_UPDATE_OPTIONS.find((option: any) => option.id === serverUpdatePolicy) || ONBOARDING_SERVER_UPDATE_OPTIONS[0];
      return jsxs("div", { className: "space-y-5", children: [
        jsxs("div", { className: "flex items-start gap-3", children: [
          jsx("div", { className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border va-accent-border va-accent-bg-soft va-accent-text", children: jsx(Database, { className: "h-6 w-6" }) }),
          jsxs("div", { children: [
            jsx("h2", { className: "text-xl font-bold text-[var(--va-text)]", children: "أين تريد حفظ بياناتك؟" }),
            jsx("p", { className: "mt-1 text-sm leading-7 text-[var(--va-text-muted)]", children: "يمكنك تغيير هذا لاحقاً. الافتراضي «هذا الجهاز» يعمل فوراً دون أي إعداد." })
          ] })
        ] }),
        jsx("div", { className: "grid auto-rows-fr gap-3 md:grid-cols-2 lg:grid-cols-4", children: availableStorageOptions.map((option: any) => {
          const Icon = (STORAGE_ICONS as any)[option.id] || Database;
          return jsx(OptionButton, {
            active: storageChoice === option.id,
            onClick: () => {
              setStorageChoice(option.id);
              if (option.id === "postgres" || option.id === "pocketbase") {
                const next = selectBackendPreset(presetConfig || {}, option.id);
                setStorageUrl(next.storageUrl);
                setCloudUsername(next.cloudUsername);
                setCloudPassword(next.cloudPassword);
              }
              setStorageTest(null);
            },
            children: jsxs("div", { className: "flex items-start gap-3", children: [
              jsx(Icon, { className: "mt-0.5 h-5 w-5 shrink-0 va-accent-text" }),
              jsxs("div", { children: [
                jsx("p", { className: "font-semibold", children: option.label }),
                jsx("p", { className: "mt-1 text-xs leading-6 text-[var(--va-text-muted)]", children: option.detail })
              ] })
            ] })
          }, option.id);
        }) }),
        forceLocal && jsx("p", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100", children: "في AI Studio تظهر الخيارات التي تعمل من جانب العميل فقط: محلي أو Firebase." }),
        selected.needsUrl && jsxs("div", { className: "space-y-2", children: [
          jsx(FieldLabel, { children: "عنوان الخادم" }),
          jsx("input", {
            type: "url",
            inputMode: "url",
            dir: "ltr",
            value: storageUrl,
            onChange: (event: any) => setStorageUrl(event.target.value),
            placeholder: selected.urlPlaceholder || "https://...",
            className: "input input-bordered w-full",
            "aria-invalid": storageUsesServer && !storageUrlValid,
            "aria-label": "عنوان الخادم"
          }),
          jsx("p", { className: "text-xs leading-6 text-[var(--va-text-muted)]", children: "نفس النطاق الذي نشرت عليه الخادم. سيُستخدم بعد إعادة التحميل لربط هذا الجهاز بالخادم." })
        ] }),
        storageChoice === "local" && jsxs("section", {
          className: "rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.03] p-4",
          "aria-label": "محرّك التخزين المحلي",
          children: [
            jsx("h3", { className: "text-base font-bold text-[var(--va-text)]", children: "محرّك التخزين المحلي" }),
            jsx("div", { className: "mt-3 grid gap-3 sm:grid-cols-2", children: [
              ["indexeddb", "IndexedDB", "مستقر ومناسب لمعظم الاستخدامات."],
              ["sqlite", "SQLite (WASM)", "ملف SQLite محلي؛ يتراجع إلى IndexedDB إذا لم تتوفر OPFS."]
            ].map(([id, label, detail]: any) => jsx(OptionButton, {
              active: localEngine === id,
              onClick: () => setLocalEngine(id),
              children: jsxs("div", { children: [
                jsx("p", { className: "font-semibold", dir: "ltr", children: label }),
                jsx("p", { className: "mt-2 text-xs leading-6 text-[var(--va-text-muted)]", children: detail })
              ] })
            }, id)) })
          ]
        }),
        storageChoice === "firebase" && jsxs("section", {
          className: "rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.03] p-4",
          "aria-label": "تهيئة Firebase",
          children: [
            jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
              jsxs("div", { className: "min-w-0", children: [
                jsx("h3", { className: "text-base font-bold text-[var(--va-text)]", children: "تهيئة Firebase" }),
                jsx("p", { className: "mt-1 text-xs leading-6 text-[var(--va-text-muted)]", children: "ألصق كائن firebaseConfig من إعدادات تطبيق الويب. تُحفظ مفاتيح العميل فقط، ولا تضع مفاتيح خادم خاصة هنا." })
              ] }),
              jsx("span", { className: `rounded-full border px-3 py-1 text-xs ${firebaseConfigState.ok ? "border-green-500/30 text-green-200" : "border-amber-500/30 text-amber-100"}`, children: firebaseConfigState.ok ? "جاهز" : "ينقصه إعداد" })
            ] }),
            jsx("textarea", {
              value: firebaseConfigText,
              onChange: (event: any) => setFirebaseConfigText(event.target.value),
              dir: "ltr",
              rows: 7,
              spellCheck: false,
              className: "textarea textarea-bordered mt-3 w-full font-mono text-xs",
              placeholder: "{\n  \"apiKey\": \"...\",\n  \"projectId\": \"...\",\n  \"appId\": \"...\"\n}"
            }),
            !firebaseConfigState.ok && jsx("p", { className: "mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100", children: `حقول مطلوبة: ${firebaseConfigState.errors.join(", ")}` })
          ]
        }),
        storageChoice === "postgres" && jsxs("section", {
          className: "rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.03] p-4",
          "aria-label": "إعداد SQL",
          children: [
            jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
              jsxs("div", { className: "min-w-0", children: [
                jsx("h3", { className: "text-base font-bold text-[var(--va-text)]", children: "إعداد SQL على الخادم" }),
                jsx("p", { className: "mt-1 text-xs leading-6 text-[var(--va-text-muted)]", children: "اختياري أثناء المعالج: أدخل رابط قاعدة البيانات لاختباره من الخادم. الحفظ النهائي لإعداد DB يتم من تبويب الصيانة بعد الدخول." })
              ] }),
              jsx("span", { className: "rounded-full border va-accent-border va-accent-bg-soft px-3 py-1 text-xs va-accent-text-on-soft", children: "موصى به" })
            ] }),
            jsxs("label", { className: "mt-3 block space-y-1 text-sm text-[var(--va-text-2)]", children: [
              jsx("span", { children: "نوع المحرّك" }),
              jsx("select", {
                value: serverEngine,
                onChange: (event: any) => changeServerEngine(event.target.value),
                className: "select select-bordered w-full",
                children: DATABASE_ENGINES.map((id: any) => jsx("option", { value: id, children: (DATABASE_ENGINE_LABELS as any)[id] || id }, id))
              })
            ] }),
            jsxs("label", { className: "mt-3 block space-y-1 text-sm text-[var(--va-text-2)]", children: [
              jsx("span", { children: "سلسلة اتصال قاعدة البيانات للاختبار" }),
              jsx("input", {
                value: serverDbUrl,
                onChange: (event: any) => setServerDbUrl(event.target.value),
                dir: "ltr",
                placeholder: serverEngine === "sqlite" ? "file:./archive.sqlite" : `${serverEngine}://user:pass@host:${(DEFAULT_PORT_BY_ENGINE as any)[serverEngine] || ""}/db`,
                className: "input input-bordered w-full"
              })
            ] }),
            !serverDbUrl.trim() && (serverEngine === "sqlite"
              ? jsxs("label", { className: "mt-3 block space-y-1 text-sm text-[var(--va-text-2)]", children: [
                  jsx("span", { children: "ملف SQLite" }),
                  jsx("input", { value: serverDbParts.file, onChange: (event: any) => setServerDbPart("file", event.target.value), dir: "ltr", className: "input input-bordered w-full" })
                ] })
              : jsx("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: [
                  ["host", "المضيف", "db.example.com"],
                  ["port", "المنفذ", (DEFAULT_PORT_BY_ENGINE as any)[serverEngine] || ""],
                  ["database", "قاعدة البيانات", "archive"],
                  ["user", "المستخدم", "archive"],
                  ["password", "كلمة المرور", ""]
                ].map(([key, label, placeholder]: any) => jsxs("label", {
                  className: `space-y-1 text-sm text-[var(--va-text-2)] ${key === "password" ? "sm:col-span-2" : ""}`,
                  children: [
                    jsx("span", { children: label }),
                    jsx("input", {
                      type: key === "password" ? "password" : "text",
                      value: (serverDbParts as any)[key] || "",
                      onChange: (event: any) => setServerDbPart(key, event.target.value),
                      dir: "ltr",
                      placeholder,
                      className: "input input-bordered w-full"
                    })
                  ]
                }, key)) }))
          ]
        }),
        storageUsesServer && jsxs("section", {
          className: "rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.03] p-4",
          "aria-label": "تسجيل الدخول للخادم",
          children: [
            jsx("h3", { className: "text-base font-bold text-[var(--va-text)]", children: "الدخول للخادم" }),
            jsx("p", { className: "mt-1 text-xs leading-6 text-[var(--va-text-muted)]", children: "إذا كان الخادم يتطلب JWT، أدخل حساب المدير لاختبار الاتصال وحفظ الجلسة قبل إعادة التحميل." }),
            jsx("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: [
              jsxs("label", { className: "space-y-1 text-sm text-[var(--va-text-2)]", children: [
                jsx("span", { children: "اسم المستخدم" }),
                jsx("input", { value: cloudUsername, onChange: (event: any) => setCloudUsername(event.target.value), dir: "ltr", className: "input input-bordered w-full" })
              ] }),
              jsxs("label", { className: "space-y-1 text-sm text-[var(--va-text-2)]", children: [
                jsx("span", { children: "كلمة المرور" }),
                jsx("input", { type: "password", value: cloudPassword, onChange: (event: any) => setCloudPassword(event.target.value), dir: "ltr", className: "input input-bordered w-full" })
              ] })
            ] }),
            jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: [
              jsx(SecondaryButton, { onClick: runStorageConnectionTest, disabled: storageTesting, children: storageTesting ? "جار الاختبار..." : "اختبار الاتصال" }),
              storageTest && jsx("p", { className: `rounded-xl border px-3 py-2 text-xs leading-6 ${(storageTest as any).ok ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-red-500/20 bg-red-500/10 text-red-100"}`, children: (storageTest as any).text })
            ] })
          ]
        }),
        jsxs("section", {
          className: "rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.03] p-4",
          "aria-label": "نسخة الخادم والتحديثات",
          children: [
            jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
              jsxs("div", { className: "min-w-0", children: [
                jsxs("h3", { className: "flex items-center gap-2 text-base font-bold text-[var(--va-text)]", children: [
                  jsx(Server, { className: "h-5 w-5 va-accent-text" }),
                  "نسخة الخادم والتحديثات"
                ] }),
                jsx("p", {
                  className: "mt-1 max-w-2xl text-xs leading-6 text-[var(--va-text-muted)]",
                  children: storageChoice === "local"
                    ? "الوضع المحلي لا يحتاج خادمًا. هذه الخيارات تصبح مهمة عند الانتقال إلى Postgres أو PocketBase."
                    : "اختر طريقة التعامل مع تحديثات archive-server حتى يعرف المشغل هل البيئة إنتاجية مستقرة أم اختبارية."
                })
              ] }),
              jsx("span", {
                className: "rounded-full border va-accent-border va-accent-bg-soft px-3 py-1 text-xs font-semibold va-accent-text-on-soft",
                children: selectedServerPolicy.badge
              })
            ] }),
            jsx("div", {
              className: "mt-4 grid auto-rows-fr gap-3 md:grid-cols-3",
              children: ONBOARDING_SERVER_UPDATE_OPTIONS.map((option: any) => jsx(OptionButton, {
                active: serverUpdatePolicy === option.id,
                onClick: () => setServerUpdatePolicy(option.id),
                children: jsxs("div", { children: [
                  jsx("p", { className: "font-semibold", children: option.label }),
                  jsx("p", { className: "mt-2 text-xs leading-6 text-[var(--va-text-muted)]", children: option.detail })
                ] })
              }, option.id))
            }),
            jsx("p", {
              className: "mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs leading-6 text-cyan-100",
              children: "عند تحديث الخادم: خذ نسخة احتياطية، حدّث archive-server، أعد تشغيل الخدمة، ثم افتح فحص النظام من الإعدادات للتأكد من الاتصال."
            })
          ]
        }),
        jsxs("p", { className: "rounded-2xl border va-accent-border va-accent-bg-soft p-3 text-xs leading-6 va-accent-text-on-soft", children: [
          jsx(Sparkles, { className: "ml-1 inline h-3.5 w-3.5" }),
          "البيانات تنتقل بين الأوضاع عبر «التصدير/الاستيراد» في مركز البيانات بنفس الصيغة — لا تفقد شيئاً عند التبديل."
        ] })
      ] });
    }

    if (activeStep.id === "file-store") {
      return jsx(FileStoreSetupStep, {
        providers: fileStoreProviders,
        value: fileStoreChoice,
        onChange: (kind: any) => {
          setFileStoreChoice(kind);
          setFileStoreTest(null);
        },
        onTest: runFileStoreConnectionTest,
        testing: fileStoreTesting,
        testResult: fileStoreTest
      });
    }

    if (activeStep.id === "appearance") {
      return jsxs("div", { className: "space-y-5", children: [
        jsx("h2", { className: "text-xl font-bold text-[var(--va-text)]", children: "اختر الهوية البصرية" }),
        jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-3", children: ONBOARDING_THEME_OPTIONS.map((option: any) => jsx(OptionButton, {
          active: themeChoice === option.id,
          onClick: () => setThemeChoice(option.id),
          children: jsxs("div", { children: [
            jsx("p", { className: "font-semibold", children: option.label }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-[var(--va-text-muted)]", children: option.detail })
          ] })
        }, option.id)) }),
        jsxs("div", { className: "space-y-3", children: [
          jsx("p", { className: "text-sm font-medium text-[var(--va-text-2)]", children: "لون التفاعل" }),
          jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: ONBOARDING_ACCENT_OPTIONS.map((option: any) => jsx(OptionButton, {
            active: accentColor === option.id,
            onClick: () => setAccentColor(option.id),
            children: jsxs("div", { className: "flex items-center gap-3", children: [
              jsx("span", { className: "h-5 w-5 rounded-full border border-[var(--va-border-soft)]", style: { backgroundColor: option.color } }),
              jsx("span", { className: "font-semibold", children: option.label })
            ] })
          }, option.id)) })
        ] }),
        jsxs("div", { className: "space-y-3", children: [
          jsx("p", { className: "text-sm font-medium text-[var(--va-text-2)]", children: "كثافة الواجهة" }),
          jsxs("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: [
            jsx(OptionButton, { active: visualDensity === "comfortable", onClick: () => setVisualDensity("comfortable"), children: jsxs("div", { children: [
              jsx("p", { className: "font-semibold", children: "مريحة" }),
              jsx("p", { className: "mt-2 text-xs text-[var(--va-text-muted)]", children: "مساحات أوسع للعمل اليومي الطويل." })
            ] }) }),
            jsx(OptionButton, { active: visualDensity === "compact", onClick: () => setVisualDensity("compact"), children: jsxs("div", { children: [
              jsx("p", { className: "font-semibold", children: "مضغوطة" }),
              jsx("p", { className: "mt-2 text-xs text-[var(--va-text-muted)]", children: "عرض أكثر للبيانات في الشاشة." })
            ] }) })
          ] })
        ] })
      ] });
    }

    if (activeStep.id === "interface") {
      const icons = [LayoutGrid, Archive, Video, HardDrive];
      return jsxs("div", { className: "space-y-4", children: [
        jsx("h2", { className: "text-xl font-bold text-[var(--va-text)]", children: "تعرف على الواجهة الأساسية" }),
        jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: CORE_UI_TOUR_ITEMS.map((item: any, index: any) => {
          const Icon = icons[index] || Sparkles;
          return jsxs("div", { className: "rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.035] p-4", children: [
            jsx(Icon, { className: "mb-3 h-5 w-5 va-accent-text" }),
            jsx("p", { className: "font-semibold text-[var(--va-text)]", children: item.label }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-[var(--va-text-muted)]", children: item.detail })
          ] }, item.label);
        }) })
      ] });
    }

    if (activeStep.id === "shortcuts") {
      return jsxs("div", { className: "space-y-4", children: [
        jsxs("div", { className: "flex items-start gap-3", children: [
          jsx("div", { className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border va-accent-border va-accent-bg-soft va-accent-text", children: jsx(Keyboard, { className: "h-6 w-6" }) }),
          jsxs("div", { children: [
            jsx("h2", { className: "text-xl font-bold text-[var(--va-text)]", children: "اختصارات أساسية" }),
            jsx("p", { className: "mt-1 text-sm leading-7 text-[var(--va-text-muted)]", children: "تعلّم 4 اختصارات تكفي لتسريع 80% من العمل اليومي. تظهر بقية القائمة بضغطة \"؟\"." })
          ] })
        ] }),
        jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: ONBOARDING_SHORTCUTS.map((item: any) => jsxs("div", {
          className: "rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.035] p-4",
          children: [
            jsx("div", { className: "flex flex-wrap items-center gap-1.5", dir: "ltr", children: item.keys.map((key: any, index: any) => jsx("kbd", {
              className: "va-mixed-token rounded-md border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-1 text-xs font-mono font-semibold va-accent-text-on-soft",
              children: key
            }, `${item.label}-${index}`)) }),
            jsx("p", { className: "mt-3 font-semibold text-[var(--va-text)]", children: item.label }),
            jsx("p", { className: "mt-1 text-xs leading-6 text-[var(--va-text-muted)]", children: item.detail })
          ]
        }, item.label)) })
      ] });
    }

    if (activeStep.id === "data") {
      const icons = { backup: FileDown, import: FileUp, transfer: HardDrive, audit: ScrollText };
      return jsxs("div", { className: "space-y-4", children: [
        jsxs("div", { className: "flex items-start gap-3", children: [
          jsx("div", { className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border va-accent-border va-accent-bg-soft va-accent-text", children: jsx(Database, { className: "h-6 w-6" }) }),
          jsxs("div", { children: [
            jsx("h2", { className: "text-xl font-bold text-[var(--va-text)]", children: "حماية البيانات والنقل" }),
            jsx("p", { className: "mt-1 text-sm leading-7 text-[var(--va-text-muted)]", children: "كل بياناتك محلية. يمكنك نسخها واستيرادها ونقلها لجهاز آخر من مركز البيانات." })
          ] })
        ] }),
        jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: ONBOARDING_DATA_TOPICS.map((topic: any) => {
          const Icon = (icons as any)[topic.id] || Database;
          return jsxs("div", {
            className: "rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.035] p-4",
            children: [
              jsx(Icon, { className: "mb-3 h-5 w-5 va-accent-text" }),
              jsx("p", { className: "font-semibold text-[var(--va-text)]", children: topic.label }),
              jsx("p", { className: "mt-2 text-xs leading-6 text-[var(--va-text-muted)]", children: topic.detail })
            ]
          }, topic.id);
        }) }),
        jsxs("p", { className: "rounded-2xl border va-accent-border va-accent-bg-soft p-3 text-xs leading-6 va-accent-text-on-soft", children: [
          jsx(Sparkles, { className: "ml-1 inline h-3.5 w-3.5" }),
          "نصيحة: اعمل نسخة احتياطية أسبوعية حتى لا تخسر تعديلاتك في حال تلف الجهاز."
        ] })
      ] });
    }

    return jsxs("div", { className: "space-y-5", children: [
      jsx("h2", { className: "text-xl font-bold text-[var(--va-text)]", children: "أين تريد أن تبدأ؟" }),
      jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: FIRST_TASK_OPTIONS.map((option: any) => {
        const Icon = option.icon;
        return jsx(OptionButton, {
          active: firstTaskChoice === option.id,
          onClick: () => setFirstTaskChoice(option.id),
          children: jsxs("div", { children: [
            jsx(Icon, { className: "mb-3 h-5 w-5 va-accent-text" }),
            jsx("p", { className: "font-semibold", children: option.label }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-[var(--va-text-muted)]", children: option.detail })
          ] })
        }, option.id);
      }) })
    ] });
  };

  if (!open) return null;

  const nextDisabled = (activeStep.id === "admin" && !canContinueAdmin) || (activeStep.id === "storage" && !canContinueStorage);

  return jsx("div", {
    ref: shellRef,
    className: "va-onboarding-shell fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden bg-[#07111f] px-3 py-4 text-right text-[var(--va-text)] sm:px-6 sm:py-8",
    dir: "rtl",
    role: "dialog",
    "aria-modal": true,
    "aria-label": replayMode ? "معالج البداية" : "معالج أول تشغيل",
    children: jsxs("div", { className: "mx-auto grid min-h-[calc(100vh-2rem)] w-full min-w-0 max-w-6xl content-center gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-stretch", children: [
      /* Decorative mesh background glows */
      jsx("div", { "aria-hidden": "true", className: "pointer-events-none fixed inset-0 overflow-hidden -z-10", children: jsxs(React.Fragment, { children: [
        jsx("div", {
          className: "absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl transition-colors duration-700",
          style: { background: "radial-gradient(circle, var(--va-accent-400, var(--va-action)), transparent 70%)" }
        }),
        jsx("div", {
          className: "absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10 blur-3xl transition-colors duration-700",
          style: { background: "radial-gradient(circle, var(--va-accent-600, var(--va-action)), transparent 70%)" }
        })
      ] }) }),
      jsxs("header", { className: "w-full min-w-0 space-y-3 lg:flex lg:h-full lg:flex-col", children: [
        jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-[var(--va-border-soft)] bg-white/[0.035] p-4 sm:p-5 lg:flex-1 lg:flex-col", children: [
          jsxs("div", { className: "min-w-0", children: [
            jsx("p", { className: "text-xs font-medium va-accent-text", children: replayMode ? "إعادة تشغيل المعالج" : "الإصدار الأول" }),
            jsx("h2", { className: "mt-2 text-lg font-bold text-[var(--va-text)]", children: "أرشيف الفيديو" }),
            jsx("p", { className: "mt-2 max-w-2xl text-xs leading-6 text-[var(--va-text-muted)]", children: "كل خطوة تظهر كشريحة واحدة واضحة، مع تقدم أفقي واختصارات تناسب العمل من الهاتف أو لوحة المفاتيح." })
          ] }),
          jsx("div", {
            className: "hidden rounded-2xl border border-[var(--va-border-soft)] bg-white/[0.025] p-3 text-xs leading-6 text-[var(--va-text-muted)] lg:block",
            children: "يدعم التشغيل المحلي والخادم السحابي، مع تفضيل واضح لتحديثات نسخة الخادم أثناء الإعداد."
          }),
          replayMode && jsx("button", {
            type: "button",
            onClick: onCancel,
            className: "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--va-border-soft)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]",
            "aria-label": "إغلاق معالج البداية",
            children: jsx(X, { className: "h-5 w-5" })
          })
        ] }),
        jsx(OnboardingProgressRail, {
          steps,
          activeStepIndex,
          onStepClick: (index: any) => moveToStepIndex(index, index > activeStepIndex ? "next" : "previous", { validate: false })
        })
      ] }),
      jsxs("section", {
        className: "va-onboarding-panel flex w-full min-w-0 flex-col overflow-hidden rounded-3xl border border-[var(--va-border-soft)] bg-[#0b1626]/95 shadow-2xl shadow-black/20",
        "aria-labelledby": activeSlideTitleId,
        children: [
          jsx(AnimatePresence, {
            initial: false,
            mode: "wait",
            children: jsx(motion.main, {
              key: activeStep.id,
              ref: slideRef,
              tabIndex: -1,
              role: "group",
              "aria-roledescription": "شريحة",
              "aria-labelledby": activeSlideTitleId,
              onPointerDown: handlePointerDown,
              onPointerUp: handlePointerUp,
              initial: { opacity: 0, x: prefersReducedMotion ? 0 : slideDirection === "next" ? -28 : 28 },
              animate: { opacity: 1, x: 0 },
              exit: { opacity: 0, x: prefersReducedMotion ? 0 : slideDirection === "next" ? 28 : -28 },
              transition: { duration: prefersReducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] },
              className: "w-full min-w-0 flex-1 overflow-hidden p-5 outline-none sm:min-h-[500px] sm:p-8 lg:min-h-[620px]",
              children: jsxs("div", {
                children: [
                  jsx("span", { id: activeSlideTitleId, className: "sr-only", children: activeStep.label }),
                  showPresetScreen && presetConfig
                    ? jsx(PresetConfigScreen, {
                        config: presetConfig,
                        onUsePreset: () => {
                          if ((presetConfig as any).backend === "pocketbase" || (presetConfig as any).backend === "postgres") {
                            const form = createPresetFormState(presetConfig);
                            setStorageChoice(form.storageChoice);
                            setStorageUrl(form.storageUrl);
                            setCloudUsername(form.cloudUsername);
                            setCloudPassword(form.cloudPassword);
                            setFileStoreChoice(form.fileStoreChoice);
                          }
                          setShowPresetScreen(false);
                          const lastStep = steps[steps.length - 1];
                          if (lastStep) setStepId(lastStep.id);
                        },
                        onManualSetup: () => setShowPresetScreen(false)
                      })
                    : renderStepBody(),
                  error && jsxs("div", { className: "mt-5 flex items-start gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-red-100", role: "alert", children: [
                    jsx(TriangleAlert, { className: "mt-0.5 h-5 w-5 shrink-0" }),
                    jsx("p", { className: "text-sm leading-7", children: error })
                  ] })
                ]
              })
            })
          }),
          jsxs("footer", { className: "sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--va-border-soft)] bg-[#0b1626]/95 p-3 backdrop-blur sm:p-5", children: [
            jsx(SecondaryButton, {
              onClick: goBack,
              disabled: isFirstStep,
              children: jsxs("span", { className: "inline-flex items-center gap-2", children: [
                jsx(ChevronRight, { className: "h-4 w-4" }),
                "السابق"
              ] })
            }),
            !replayMode && jsx("button", {
              type: "button",
              onClick: toggleAdvancedSetupMode,
              "aria-pressed": advancedSetupMode === "advanced",
              className: "text-xs font-semibold text-[var(--va-text-muted)] underline-offset-4 hover:text-[var(--va-text)] hover:underline focus-visible:outline-none focus-visible:underline",
              children: advancedSetupMode === "advanced" ? "إخفاء الخيارات المتقدمة" : "المزيد من الخيارات"
            }),
            jsxs("div", { className: "flex flex-wrap justify-end gap-2", children: [
              replayMode && jsx(SecondaryButton, { onClick: onCancel, children: "إغلاق" }),
              !isLastStep ? jsx(PrimaryButton, {
                onClick: goNext,
                disabled: nextDisabled,
                children: jsxs("span", { className: "inline-flex items-center gap-2", children: [
                  "التالي",
                  jsx(ChevronLeft, { className: "h-4 w-4" })
                ] })
              }) : jsx(PrimaryButton, { onClick: finishWizard, disabled: isSubmitting, children: isSubmitting ? "جارٍ الحفظ..." : replayMode ? "إنهاء المراجعة" : "إكمال الإعداد" })
            ] })
          ] })
        ]
      })
    ] })
  });
}

export default V1OnboardingWizard;
