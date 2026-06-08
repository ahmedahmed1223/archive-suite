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
  ChevronLeft,
  ChevronRight,
  Cloud,
  Database,
  FileDown,
  FileUp,
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
  getBackendUrl,
  getLocalEngine,
  normalizeBackendChoice,
  setBackendChoice,
  shouldForceLocalBackend
} from "../../bootstrap/backendChoice.js";
import { getCloudToken, loginToCloud } from "../../bootstrap/cloudSession.js";
import { PasswordField } from "../../components/common/PasswordField.jsx";
import {
  DATABASE_ENGINES,
  DATABASE_ENGINE_LABELS,
  buildDatabaseUrl,
  normalizeDatabaseEngine,
  testDbConnection
} from "../settings/dbConfigClient.js";
import { fetchServerHealth } from "../server-status/serverHealthClient.js";
import { validatePasswordStrength } from "../../utils/passwordHash.js";

const STORAGE_ICONS = { local: Laptop, postgres: Server, pocketbase: Cloud };
const DEFAULT_PORT_BY_ENGINE = { postgresql: "5432", mysql: "3306", sqlserver: "1433" };

const FIRST_TASK_OPTIONS = [
  { id: "dashboard", label: "مركز التحكم", detail: "ابدأ من جاهزية اليوم والإجراءات السريعة.", icon: LayoutGrid },
  { id: "add-video", label: "إضافة فيديو", detail: "افتح نموذج الإضافة مباشرة بعد الدخول.", icon: Video },
  { id: "import-backup", label: "استيراد أو نقل", detail: "ابدأ من مركز البيانات لاستيراد نسخة أو ملف نقل.", icon: HardDrive },
  { id: "create-type", label: "إنشاء نوع", detail: "جهز أول نوع محتوى وحقوله قبل الأرشفة.", icon: Database }
];

const EXTRA_STEPS = [
  ...ONBOARDING_STEPS,
  { id: "first-task", label: "البداية", detail: "اختيار أول شاشة بعد الإعداد." }
];

const arabicNumber = new Intl.NumberFormat("ar");

function formatStepCount(current, total) {
  return `${arabicNumber.format(current)} / ${arabicNumber.format(total)}`;
}

function getInitialStepId(savedStepId, steps) {
  if (steps.some((step) => step.id === savedStepId)) return savedStepId;
  return steps[0]?.id || "welcome";
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.("button,a,input,textarea,select,[contenteditable='true']"));
}

function OnboardingProgressRail({ steps, activeStepIndex, onStepClick }) {
  const activeStep = steps[activeStepIndex] || steps[0];
  return jsxs("nav", {
    className: "va-onboarding-progress rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3",
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
                className: "mt-1 truncate text-sm font-semibold text-white",
                children: activeStep?.label || "البدء"
              })
            ]
          }),
          jsx("div", {
            className: "flex flex-wrap items-center justify-start gap-1",
            children: steps.map((step, index) => {
              const active = index === activeStepIndex;
              const visited = index <= activeStepIndex;
              return jsx("button", {
                type: "button",
                disabled: !visited,
                onClick: () => visited && onStepClick(index),
                "aria-current": active ? "step" : undefined,
                className: [
                  "flex h-11 items-center justify-center rounded-full transition-colors",
                  active ? "w-9" : "w-6",
                  visited ? "hover:bg-white/5" : "cursor-not-allowed"
                ].join(" "),
                children: jsxs("span", {
                  className: [
                    "block rounded-full transition-all",
                    active ? "h-3 w-8 va-accent-bg" : visited ? "h-3 w-3 va-accent-bg-soft" : "h-3 w-3 bg-white/15"
                  ].join(" "),
                  children: [
                    jsx("span", { className: "sr-only", children: `${visited ? "الانتقال إلى" : "خطوة لاحقة"} ${step.label}` })
                  ]
                })
              }, step.id);
            })
          })
        ]
      }),
      jsx("div", {
        className: "mt-3 h-1.5 overflow-hidden rounded-full bg-white/10",
        dir: "rtl",
        "aria-hidden": "true",
        children: jsx("div", {
          className: "h-full rounded-full va-accent-bg transition-all duration-300",
          style: { width: `${((activeStepIndex + 1) / Math.max(steps.length, 1)) * 100}%` }
        })
      }),
      jsx("ol", {
        className: "mt-4 hidden space-y-2 lg:block",
        children: steps.map((step, index) => {
          const active = index === activeStepIndex;
          const visited = index <= activeStepIndex;
          return jsx("li", {
            children: jsxs("button", {
              type: "button",
              disabled: !visited,
              onClick: () => visited && onStepClick(index),
              "aria-current": active ? "step" : undefined,
              className: `flex min-h-[4rem] w-full items-start gap-3 rounded-xl border p-3 text-right transition-colors ${
                active
                  ? "va-accent-border va-accent-bg-soft text-white"
                  : visited
                    ? "border-white/10 bg-white/[0.025] text-gray-300 hover:bg-white/[0.05]"
                    : "cursor-not-allowed border-white/5 bg-white/[0.015] text-gray-600"
              }`,
              children: [
                jsx("span", {
                  className: `mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] font-semibold ${
                    active ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 bg-white/[0.03]"
                  }`,
                  children: formatStepCount(index + 1, steps.length).split(" / ")[0]
                }),
                jsxs("span", {
                  className: "min-w-0",
                  children: [
                    jsx("span", { className: "block truncate text-sm font-semibold", children: step.label }),
                    jsx("span", { className: "mt-1 block line-clamp-2 text-xs leading-5 text-gray-500", children: step.detail })
                  ]
                })
              ]
            })
          }, step.id);
        })
      })
    ]
  });
}

function getPasswordStrength(password = "") {
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

function FieldLabel({ children }) {
  return jsx("label", {
    className: "block text-sm font-medium text-gray-200",
    children
  });
}

function OptionButton({ active, children, onClick }) {
  return jsx("button", {
    type: "button",
    onClick,
    "aria-pressed": active,
    className: `va-tool-button h-full min-h-[88px] w-full rounded-2xl border p-4 text-right transition-all ${
      active
        ? "va-accent-border va-accent-bg-soft text-white shadow-lg shadow-emerald-500/10"
        : "border-white/10 bg-white/[0.035] text-gray-300 hover:border-emerald-500/25 hover:bg-white/[0.06]"
    }`,
    children
  });
}

function PrimaryButton({ children, onClick, disabled = false, type = "button" }) {
  return jsx("button", {
    type,
    onClick,
    disabled,
    className: "va-primary-button inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    children
  });
}

function SecondaryButton({ children, onClick, disabled = false }) {
  return jsx("button", {
    type: "button",
    onClick,
    disabled,
    className: "va-secondary-button inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-5 py-2 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50",
    children
  });
}

export function V1OnboardingWizard({ open, mode = "startup", onComplete, onCancel }) {
  const replayMode = mode === "replay";
  const {
    settings,
    isPasswordSet,
    setMasterPassword,
    skipPasswordSetup,
    updateSettings,
    showToast
  } = useAppStore();
  const authStore = useAuthStore();
  const { setTheme } = useTheme();
  const [securityMode, setSecurityMode] = React.useState(() => normalizeOnboardingSecurityMode(settings.ui?.onboardingSecurityMode || "secure"));
  const [themeChoice, setThemeChoice] = React.useState(() => normalizeOnboardingThemeChoice(settings.ui?.onboardingThemeChoice || settings.theme || "dark"));
  const [accentColor, setAccentColor] = React.useState(() => normalizeOnboardingAccentChoice(settings.accentColor || "teal"));
  const [visualDensity, setVisualDensity] = React.useState(settings.ui?.visualDensity === "compact" ? "compact" : "comfortable");
  const [firstTaskChoice, setFirstTaskChoice] = React.useState(settings.ui?.firstTaskChoice || "dashboard");
  const [serverUpdatePolicy, setServerUpdatePolicy] = React.useState(() => normalizeOnboardingServerUpdatePolicy(settings.ui?.serverUpdatePolicy || "stable"));
  // Backend choice is read from localStorage (set by a previous run) so the
  // wizard reflects the current wiring; defaults to "local" on first run.
  const [storageChoice, setStorageChoice] = React.useState(() => getBackendChoice());
  const [storageUrl, setStorageUrl] = React.useState(() => getBackendUrl());
  const [localEngine, setLocalEngine] = React.useState(() => getLocalEngine());
  const [serverEngine, setServerEngine] = React.useState("postgresql");
  const [serverDbUrl, setServerDbUrl] = React.useState("");
  const [serverDbParts, setServerDbParts] = React.useState({ host: "", port: "5432", database: "archive", user: "archive", password: "", file: "./archive.sqlite" });
  const [cloudUsername, setCloudUsername] = React.useState("admin");
  const [cloudPassword, setCloudPassword] = React.useState("");
  const [storageTest, setStorageTest] = React.useState(null);
  const [storageTesting, setStorageTesting] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // AI Studio sandboxes the SPA in an iframe that can't reach a remote server,
  // so the build forces local-only and we hide the storage step entirely.
  const forceLocal = shouldForceLocalBackend();

  const steps = React.useMemo(() => {
    let list = EXTRA_STEPS;
    if (!replayMode && securityMode === "quick") list = list.filter((step) => step.id !== "admin");
    // Hide the storage step when the backend is forced (AI Studio).
    if (forceLocal) list = list.filter((step) => step.id !== "storage");
    return list;
  }, [replayMode, securityMode, forceLocal]);
  const [stepId, setStepId] = React.useState(settings.ui?.lastOnboardingStep && EXTRA_STEPS.some((step) => step.id === settings.ui.lastOnboardingStep) ? settings.ui.lastOnboardingStep : "welcome");
  const activeStepIndex = Math.max(0, steps.findIndex((step) => step.id === stepId));
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
  const storageNeedsUrl = storageChoice === "postgres" || storageChoice === "pocketbase";
  const storageUrlValid = !storageNeedsUrl || /^https?:\/\/.+/i.test(storageUrl.trim());
  const canContinueStorage = !storageNeedsUrl || storageUrlValid;
  const storageDbCandidateUrl = React.useCallback(() => {
    if (serverDbUrl.trim()) return serverDbUrl.trim();
    return buildDatabaseUrl({
      ...serverDbParts,
      engine: serverEngine,
      port: Number(serverDbParts.port) || DEFAULT_PORT_BY_ENGINE[serverEngine]
    });
  }, [serverDbParts, serverDbUrl, serverEngine]);
  const setServerDbPart = (key, value) => setServerDbParts((parts) => ({ ...parts, [key]: value }));
  const changeServerEngine = (next) => {
    const normalized = normalizeDatabaseEngine(next);
    setServerEngine(normalized);
    setServerDbParts((parts) => ({ ...parts, port: DEFAULT_PORT_BY_ENGINE[normalized] || parts.port, file: parts.file || "./archive.sqlite" }));
  };
  const runStorageConnectionTest = async () => {
    setStorageTest(null);
    if (storageChoice === "local") {
      setStorageTest({ ok: true, text: localEngine === "sqlite" ? "سيُستخدم SQLite المحلي عبر OPFS عند توفره، مع تراجع آمن إلى IndexedDB." : "الوضع المحلي جاهز عبر IndexedDB." });
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
        });
        setStorageTest({
          ok: db.ok !== false && health?.ok !== false,
          text: db.ok === false ? db.error || "فشل اختبار قاعدة البيانات." : "نجح فحص الخادم واختبار إعداد قاعدة البيانات."
        });
      } else {
        setStorageTest({ ok: health?.db?.ok !== false, text: health?.db?.ok === false ? health.db.error || "الخادم يعمل لكن قاعدة البيانات متدهورة." : "الخادم متاح وحالة قاعدة البيانات مقروءة." });
      }
    } catch (error) {
      setStorageTest({ ok: false, text: error?.message || "فشل اختبار الاتصال." });
    } finally {
      setStorageTesting(false);
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
      setError("أدخل عنوان خادم صحيح يبدأ بـ http:// أو https:// قبل المتابعة.");
      return false;
    }
    return true;
  }, [activeStep?.id, canContinueAdmin, canContinueStorage]);

  const persistStepProgress = React.useCallback((nextStepId) => {
    if (replayMode || !nextStepId) return;
    updateSettings?.({
      ui: {
        ...(settings.ui || {}),
        lastOnboardingStep: nextStepId,
        onboardingSecurityMode: securityMode,
        onboardingThemeChoice: themeChoice,
        firstTaskChoice,
        serverUpdatePolicy
      }
    });
  }, [firstTaskChoice, replayMode, securityMode, serverUpdatePolicy, settings.ui, themeChoice, updateSettings]);

  const moveToStepIndex = React.useCallback((nextIndex, direction = "next", { validate = true } = {}) => {
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
      moveToStepIndex(steps.findIndex((step) => step.id === "appearance"), "next", { validate: false });
    }
  }, [moveToStepIndex, replayMode, securityMode, stepId, steps]);

  React.useEffect(() => {
    if (!open) return;
    const frameId = window.requestAnimationFrame(() => {
      shellRef.current?.scrollTo?.({ top: 0, behavior: "auto" });
      slideRef.current?.focus?.({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeStep?.id, open, prefersReducedMotion]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
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

  const handlePointerDown = (event) => {
    if (isInteractiveTarget(event.target)) return;
    pointerStartXRef.current = event.clientX;
  };

  const handlePointerUp = (event) => {
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
      firstTaskChoice,
      serverUpdatePolicy,
      replayMode,
      now
    });
    // Persist the storage backend choice before anything else. It lives in
    // localStorage (not settings) because the boot path reads it BEFORE the
    // store — which itself needs a backend — can load. forceLocal builds
    // (AI Studio) skip this; the choice stays "local". The actual re-wiring
    // to a cloud backend happens on next boot via resolveBackendChoice.
    try {
      if (!forceLocal && storageNeedsUrl && cloudUsername.trim() && cloudPassword) {
        await loginToCloud({ baseUrl: storageUrl.trim(), username: cloudUsername.trim(), password: cloudPassword });
      }
      if (!forceLocal) {
        setBackendChoice(
          normalizeBackendChoice(storageChoice),
          storageNeedsUrl ? storageUrl.trim() : "",
          { localEngine }
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
      await updateSettings(completionPatch);
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
        const adminUser = freshUsers.find((user) => user.username === "admin" && user.isActive !== false) || freshUsers.find((user) => user.isActive !== false);
        if (adminUser) {
          useAuthStore.setState({ currentUser: adminUser, isAuthenticated: true, authError: null });
        }
        showToast?.("تم تفعيل البدء السريع بدون كلمة مرور. يمكنك إضافة الحماية لاحقاً من الإعدادات.", "warning");
      }

      onComplete?.({ replayMode, securityMode, firstTaskChoice, serverUpdatePolicy });
    } catch (errorObject) {
      handleAppError(errorObject, "معالج بدء التشغيل", { message: "تعذر إكمال معالج البداية" });
      setError("تعذر إكمال المعالج. راجع فحص النظام أو حاول مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepBody = () => {
    if (activeStep.id === "welcome") {
      return jsxs("div", { className: "space-y-5", children: [
        jsx("div", { className: "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl va-accent-bg-soft va-accent-text", children: jsx(Video, { className: "h-8 w-8" }) }),
        jsx("h1", { className: "text-2xl font-bold text-white", children: replayMode ? "معالج البداية" : "مرحباً بك في أرشيف الفيديو" }),
        jsx("p", { className: "mx-auto max-w-2xl text-sm leading-7 text-gray-400", children: replayMode ? "يمكنك مراجعة أساسيات الواجهة وتعديل تفضيلات البداية بدون تغيير كلمة المرور." : "سنجهز التطبيق بعد شاشة التحميل مباشرة: الحماية، المدير، المظهر، ثم أول شاشة تناسب عملك اليومي." }),
        jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-3", children: [
          ["محلي بالكامل", "تظل بياناتك على هذا الجهاز."],
          ["جاهز للنقل", "يمكنك التصدير لاحقاً لجهاز آخر."],
          ["RTL أولاً", "التجربة مصممة للعربية من البداية."]
        ].map(([title, detail]) => jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/[0.035] p-4", children: [
          jsx("p", { className: "font-semibold text-white", children: title }),
          jsx("p", { className: "mt-1 text-xs leading-6 text-gray-500", children: detail })
        ] }, title)) })
      ] });
    }

    if (activeStep.id === "security") {
      return jsxs("div", { className: "space-y-4", children: [
        jsx("h2", { className: "text-xl font-bold text-white", children: "اختر وضع الحماية" }),
        jsxs("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: [
          jsx(OptionButton, { active: securityMode === "secure", onClick: () => setSecurityMode("secure"), children: jsxs("div", { children: [
            jsx(ShieldCheck, { className: "mb-3 h-6 w-6 va-accent-text" }),
            jsx("p", { className: "font-semibold", children: "الإعداد الآمن" }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-gray-400", children: "تعيين كلمة مرور للمدير قبل فتح التطبيق. هذا هو الخيار الموصى به." })
          ] }) }),
          jsx(OptionButton, { active: securityMode === "quick", onClick: () => setSecurityMode("quick"), children: jsxs("div", { children: [
            jsx(Shield, { className: "mb-3 h-6 w-6 text-amber-300" }),
            jsx("p", { className: "font-semibold", children: "البدء السريع" }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-gray-400", children: "يفتح التطبيق محلياً بدون كلمة مرور. ستظهر بطاقة لاحقة لاستكمال الحماية." })
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
          jsx("h2", { className: "text-xl font-bold text-white", children: "حالة المدير والحماية" }),
          jsx("p", { className: "text-sm leading-7 text-gray-400", children: isPasswordSet ? "الحماية مفعلة بالفعل. لا يغير وضع إعادة التشغيل كلمة المرور." : "الحماية غير مفعلة حالياً. يمكنك ضبطها من تبويب الأمان في الإعدادات." }),
          jsx(SecondaryButton, { onClick: openSecuritySettings, children: "فتح إعدادات الأمان" })
        ] });
      }
      return jsxs("div", { className: "space-y-4", children: [
        jsx("h2", { className: "text-xl font-bold text-white", children: "عيّن كلمة مرور المدير" }),
        jsx("p", { className: "text-sm leading-7 text-gray-400", children: "هذه الكلمة تؤمّن التطبيق وتصبح كلمة دخول حساب المدير." }),
        jsxs("div", { className: "max-w-md space-y-2", children: [
          jsx(FieldLabel, { children: "كلمة المرور" }),
          jsx(PasswordField, {
            value: password,
            autoComplete: "new-password",
            ariaLabel: "كلمة مرور المدير",
            onChange: (event) => {
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
            onChange: (event) => {
              setConfirmPassword(event.target.value);
              setError("");
            }
          })
        ] }),
        jsxs("div", { className: "flex max-w-md flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3", children: [
          jsxs("div", { children: [
            jsx("p", { className: "text-sm text-gray-300", children: "قوة كلمة المرور" }),
            jsx("p", { className: "text-xs", style: { color: passwordStrength.color }, children: passwordStrength.label })
          ] }),
          jsx("div", { className: "flex min-w-32 flex-1 gap-1", dir: "rtl", children: [1, 2, 3, 4].map((level) => jsx("span", {
            className: "h-2 flex-1 rounded-full",
            style: { backgroundColor: passwordStrength.score >= level ? passwordStrength.color : "rgba(255,255,255,0.08)" }
          }, level)) })
        ] }),
        password.length > 0 && passwordPolicyErrors.length > 0 && jsx("p", { className: "text-xs leading-6 text-amber-300/90", children: passwordPolicyErrors[0] }),
        confirmPassword && jsx("p", { className: `text-sm ${passwordMatches ? "va-accent-text" : "text-red-300"}`, children: passwordMatches ? "كلمة المرور متطابقة" : "كلمة المرور غير متطابقة" })
      ] });
    }

    if (activeStep.id === "storage") {
      const selected = ONBOARDING_STORAGE_OPTIONS.find((option) => option.id === storageChoice) || ONBOARDING_STORAGE_OPTIONS[0];
      const selectedServerPolicy = ONBOARDING_SERVER_UPDATE_OPTIONS.find((option) => option.id === serverUpdatePolicy) || ONBOARDING_SERVER_UPDATE_OPTIONS[0];
      return jsxs("div", { className: "space-y-5", children: [
        jsxs("div", { className: "flex items-start gap-3", children: [
          jsx("div", { className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border va-accent-border va-accent-bg-soft va-accent-text", children: jsx(Database, { className: "h-6 w-6" }) }),
          jsxs("div", { children: [
            jsx("h2", { className: "text-xl font-bold text-white", children: "أين تريد حفظ بياناتك؟" }),
            jsx("p", { className: "mt-1 text-sm leading-7 text-gray-400", children: "يمكنك تغيير هذا لاحقاً. الافتراضي «هذا الجهاز» يعمل فوراً دون أي إعداد." })
          ] })
        ] }),
        jsx("div", { className: "grid auto-rows-fr gap-3 md:grid-cols-3", children: ONBOARDING_STORAGE_OPTIONS.map((option) => {
          const Icon = STORAGE_ICONS[option.id] || Database;
          return jsx(OptionButton, {
            active: storageChoice === option.id,
            onClick: () => setStorageChoice(option.id),
            children: jsxs("div", { className: "flex items-start gap-3", children: [
              jsx(Icon, { className: "mt-0.5 h-5 w-5 shrink-0 va-accent-text" }),
              jsxs("div", { children: [
                jsx("p", { className: "font-semibold", children: option.label }),
                jsx("p", { className: "mt-1 text-xs leading-6 text-gray-400", children: option.detail })
              ] })
            ] })
          }, option.id);
        }) }),
        selected.needsUrl && jsxs("div", { className: "space-y-2", children: [
          jsx(FieldLabel, { children: "عنوان الخادم" }),
          jsx("input", {
            type: "url",
            inputMode: "url",
            dir: "ltr",
            value: storageUrl,
            onChange: (event) => setStorageUrl(event.target.value),
            placeholder: selected.urlPlaceholder || "https://...",
            className: "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-emerald-500/50",
            "aria-invalid": storageNeedsUrl && !storageUrlValid,
            "aria-label": "عنوان الخادم"
          }),
          jsx("p", { className: "text-xs leading-6 text-gray-500", children: "نفس النطاق الذي نشرت عليه الخادم. سيُستخدم بعد إعادة التحميل لربط هذا الجهاز بالخادم." })
        ] }),
        storageChoice === "local" && jsxs("section", {
          className: "rounded-2xl border border-white/10 bg-white/[0.03] p-4",
          "aria-label": "محرّك التخزين المحلي",
          children: [
            jsx("h3", { className: "text-base font-bold text-white", children: "محرّك التخزين المحلي" }),
            jsx("div", { className: "mt-3 grid gap-3 sm:grid-cols-2", children: [
              ["indexeddb", "IndexedDB", "مستقر ومناسب لمعظم الاستخدامات."],
              ["sqlite", "SQLite (WASM)", "ملف SQLite محلي؛ يتراجع إلى IndexedDB إذا لم تتوفر OPFS."]
            ].map(([id, label, detail]) => jsx(OptionButton, {
              active: localEngine === id,
              onClick: () => setLocalEngine(id),
              children: jsxs("div", { children: [
                jsx("p", { className: "font-semibold", dir: "ltr", children: label }),
                jsx("p", { className: "mt-2 text-xs leading-6 text-gray-400", children: detail })
              ] })
            }, id)) })
          ]
        }),
        storageChoice === "postgres" && jsxs("section", {
          className: "rounded-2xl border border-white/10 bg-white/[0.03] p-4",
          "aria-label": "إعداد SQL",
          children: [
            jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
              jsxs("div", { className: "min-w-0", children: [
                jsx("h3", { className: "text-base font-bold text-white", children: "إعداد SQL على الخادم" }),
                jsx("p", { className: "mt-1 text-xs leading-6 text-gray-500", children: "اختياري أثناء المعالج: أدخل رابط قاعدة البيانات لاختباره من الخادم. الحفظ النهائي لإعداد DB يتم من تبويب الصيانة بعد الدخول." })
              ] }),
              jsx("span", { className: "rounded-full border va-accent-border va-accent-bg-soft px-3 py-1 text-xs va-accent-text-on-soft", children: "موصى به" })
            ] }),
            jsxs("label", { className: "mt-3 block space-y-1 text-sm text-gray-300", children: [
              jsx("span", { children: "نوع المحرّك" }),
              jsx("select", {
                value: serverEngine,
                onChange: (event) => changeServerEngine(event.target.value),
                className: "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50",
                children: DATABASE_ENGINES.map((id) => jsx("option", { value: id, children: DATABASE_ENGINE_LABELS[id] || id }, id))
              })
            ] }),
            jsxs("label", { className: "mt-3 block space-y-1 text-sm text-gray-300", children: [
              jsx("span", { children: "سلسلة اتصال قاعدة البيانات للاختبار" }),
              jsx("input", {
                value: serverDbUrl,
                onChange: (event) => setServerDbUrl(event.target.value),
                dir: "ltr",
                placeholder: serverEngine === "sqlite" ? "file:./archive.sqlite" : `${serverEngine}://user:pass@host:${DEFAULT_PORT_BY_ENGINE[serverEngine] || ""}/db`,
                className: "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-start text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-emerald-500/50"
              })
            ] }),
            !serverDbUrl.trim() && (serverEngine === "sqlite"
              ? jsxs("label", { className: "mt-3 block space-y-1 text-sm text-gray-300", children: [
                  jsx("span", { children: "ملف SQLite" }),
                  jsx("input", { value: serverDbParts.file, onChange: (event) => setServerDbPart("file", event.target.value), dir: "ltr", className: "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-start text-sm text-white outline-none focus:border-emerald-500/50" })
                ] })
              : jsx("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: [
                  ["host", "المضيف", "db.example.com"],
                  ["port", "المنفذ", DEFAULT_PORT_BY_ENGINE[serverEngine] || ""],
                  ["database", "قاعدة البيانات", "archive"],
                  ["user", "المستخدم", "archive"],
                  ["password", "كلمة المرور", ""]
                ].map(([key, label, placeholder]) => jsxs("label", {
                  className: `space-y-1 text-sm text-gray-300 ${key === "password" ? "sm:col-span-2" : ""}`,
                  children: [
                    jsx("span", { children: label }),
                    jsx("input", {
                      type: key === "password" ? "password" : "text",
                      value: serverDbParts[key] || "",
                      onChange: (event) => setServerDbPart(key, event.target.value),
                      dir: "ltr",
                      placeholder,
                      className: "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-start text-sm text-white outline-none focus:border-emerald-500/50"
                    })
                  ]
                }, key)) }))
          ]
        }),
        storageNeedsUrl && jsxs("section", {
          className: "rounded-2xl border border-white/10 bg-white/[0.03] p-4",
          "aria-label": "تسجيل الدخول للخادم",
          children: [
            jsx("h3", { className: "text-base font-bold text-white", children: "الدخول للخادم" }),
            jsx("p", { className: "mt-1 text-xs leading-6 text-gray-500", children: "إذا كان الخادم يتطلب JWT، أدخل حساب المدير لاختبار الاتصال وحفظ الجلسة قبل إعادة التحميل." }),
            jsx("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: [
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
                jsx("span", { children: "اسم المستخدم" }),
                jsx("input", { value: cloudUsername, onChange: (event) => setCloudUsername(event.target.value), dir: "ltr", className: "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-start text-sm text-white outline-none focus:border-emerald-500/50" })
              ] }),
              jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
                jsx("span", { children: "كلمة المرور" }),
                jsx("input", { type: "password", value: cloudPassword, onChange: (event) => setCloudPassword(event.target.value), dir: "ltr", className: "w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-start text-sm text-white outline-none focus:border-emerald-500/50" })
              ] })
            ] }),
            jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: [
              jsx(SecondaryButton, { onClick: runStorageConnectionTest, disabled: storageTesting, children: storageTesting ? "جار الاختبار..." : "اختبار الاتصال" }),
              storageTest && jsx("p", { className: `rounded-xl border px-3 py-2 text-xs leading-6 ${storageTest.ok ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-red-500/20 bg-red-500/10 text-red-100"}`, children: storageTest.text })
            ] })
          ]
        }),
        jsxs("section", {
          className: "rounded-2xl border border-white/10 bg-white/[0.03] p-4",
          "aria-label": "نسخة الخادم والتحديثات",
          children: [
            jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
              jsxs("div", { className: "min-w-0", children: [
                jsxs("h3", { className: "flex items-center gap-2 text-base font-bold text-white", children: [
                  jsx(Server, { className: "h-5 w-5 va-accent-text" }),
                  "نسخة الخادم والتحديثات"
                ] }),
                jsx("p", {
                  className: "mt-1 max-w-2xl text-xs leading-6 text-gray-500",
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
              children: ONBOARDING_SERVER_UPDATE_OPTIONS.map((option) => jsx(OptionButton, {
                active: serverUpdatePolicy === option.id,
                onClick: () => setServerUpdatePolicy(option.id),
                children: jsxs("div", { children: [
                  jsx("p", { className: "font-semibold", children: option.label }),
                  jsx("p", { className: "mt-2 text-xs leading-6 text-gray-400", children: option.detail })
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

    if (activeStep.id === "appearance") {
      return jsxs("div", { className: "space-y-5", children: [
        jsx("h2", { className: "text-xl font-bold text-white", children: "اختر الهوية البصرية" }),
        jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-3", children: ONBOARDING_THEME_OPTIONS.map((option) => jsx(OptionButton, {
          active: themeChoice === option.id,
          onClick: () => setThemeChoice(option.id),
          children: jsxs("div", { children: [
            jsx("p", { className: "font-semibold", children: option.label }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-gray-400", children: option.detail })
          ] })
        }, option.id)) }),
        jsxs("div", { className: "space-y-3", children: [
          jsx("p", { className: "text-sm font-medium text-gray-200", children: "لون التفاعل" }),
          jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: ONBOARDING_ACCENT_OPTIONS.map((option) => jsx(OptionButton, {
            active: accentColor === option.id,
            onClick: () => setAccentColor(option.id),
            children: jsxs("div", { className: "flex items-center gap-3", children: [
              jsx("span", { className: "h-5 w-5 rounded-full border border-white/30", style: { backgroundColor: option.color } }),
              jsx("span", { className: "font-semibold", children: option.label })
            ] })
          }, option.id)) })
        ] }),
        jsxs("div", { className: "space-y-3", children: [
          jsx("p", { className: "text-sm font-medium text-gray-200", children: "كثافة الواجهة" }),
          jsxs("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: [
            jsx(OptionButton, { active: visualDensity === "comfortable", onClick: () => setVisualDensity("comfortable"), children: jsxs("div", { children: [
              jsx("p", { className: "font-semibold", children: "مريحة" }),
              jsx("p", { className: "mt-2 text-xs text-gray-400", children: "مساحات أوسع للعمل اليومي الطويل." })
            ] }) }),
            jsx(OptionButton, { active: visualDensity === "compact", onClick: () => setVisualDensity("compact"), children: jsxs("div", { children: [
              jsx("p", { className: "font-semibold", children: "مضغوطة" }),
              jsx("p", { className: "mt-2 text-xs text-gray-400", children: "عرض أكثر للبيانات في الشاشة." })
            ] }) })
          ] })
        ] })
      ] });
    }

    if (activeStep.id === "interface") {
      const icons = [LayoutGrid, Archive, Video, HardDrive];
      return jsxs("div", { className: "space-y-4", children: [
        jsx("h2", { className: "text-xl font-bold text-white", children: "تعرف على الواجهة الأساسية" }),
        jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: CORE_UI_TOUR_ITEMS.map((item, index) => {
          const Icon = icons[index] || Sparkles;
          return jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/[0.035] p-4", children: [
            jsx(Icon, { className: "mb-3 h-5 w-5 va-accent-text" }),
            jsx("p", { className: "font-semibold text-white", children: item.label }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-gray-400", children: item.detail })
          ] }, item.label);
        }) })
      ] });
    }

    if (activeStep.id === "shortcuts") {
      return jsxs("div", { className: "space-y-4", children: [
        jsxs("div", { className: "flex items-start gap-3", children: [
          jsx("div", { className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border va-accent-border va-accent-bg-soft va-accent-text", children: jsx(Keyboard, { className: "h-6 w-6" }) }),
          jsxs("div", { children: [
            jsx("h2", { className: "text-xl font-bold text-white", children: "اختصارات أساسية" }),
            jsx("p", { className: "mt-1 text-sm leading-7 text-gray-400", children: "تعلّم 4 اختصارات تكفي لتسريع 80% من العمل اليومي. تظهر بقية القائمة بضغطة \"؟\"." })
          ] })
        ] }),
        jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: ONBOARDING_SHORTCUTS.map((item) => jsxs("div", {
          className: "rounded-2xl border border-white/10 bg-white/[0.035] p-4",
          children: [
            jsx("div", { className: "flex flex-wrap items-center gap-1.5", dir: "ltr", children: item.keys.map((key, index) => jsx("kbd", {
              className: "va-mixed-token rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs font-mono font-semibold va-accent-text-on-soft",
              children: key
            }, `${item.label}-${index}`)) }),
            jsx("p", { className: "mt-3 font-semibold text-white", children: item.label }),
            jsx("p", { className: "mt-1 text-xs leading-6 text-gray-400", children: item.detail })
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
            jsx("h2", { className: "text-xl font-bold text-white", children: "حماية البيانات والنقل" }),
            jsx("p", { className: "mt-1 text-sm leading-7 text-gray-400", children: "كل بياناتك محلية. يمكنك نسخها واستيرادها ونقلها لجهاز آخر من مركز البيانات." })
          ] })
        ] }),
        jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: ONBOARDING_DATA_TOPICS.map((topic) => {
          const Icon = icons[topic.id] || Database;
          return jsxs("div", {
            className: "rounded-2xl border border-white/10 bg-white/[0.035] p-4",
            children: [
              jsx(Icon, { className: "mb-3 h-5 w-5 va-accent-text" }),
              jsx("p", { className: "font-semibold text-white", children: topic.label }),
              jsx("p", { className: "mt-2 text-xs leading-6 text-gray-400", children: topic.detail })
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
      jsx("h2", { className: "text-xl font-bold text-white", children: "أين تريد أن تبدأ؟" }),
      jsx("div", { className: "grid auto-rows-fr gap-3 sm:grid-cols-2", children: FIRST_TASK_OPTIONS.map((option) => {
        const Icon = option.icon;
        return jsx(OptionButton, {
          active: firstTaskChoice === option.id,
          onClick: () => setFirstTaskChoice(option.id),
          children: jsxs("div", { children: [
            jsx(Icon, { className: "mb-3 h-5 w-5 va-accent-text" }),
            jsx("p", { className: "font-semibold", children: option.label }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-gray-400", children: option.detail })
          ] })
        }, option.id);
      }) })
    ] });
  };

  if (!open) return null;

  const nextDisabled = (activeStep.id === "admin" && !canContinueAdmin) || (activeStep.id === "storage" && !canContinueStorage);

  return jsx("div", {
    ref: shellRef,
    className: "va-onboarding-shell fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden bg-[#07111f] px-3 py-4 text-right text-white sm:px-6 sm:py-8",
    dir: "rtl",
    role: "dialog",
    "aria-modal": true,
    "aria-label": replayMode ? "معالج البداية" : "معالج أول تشغيل",
    children: jsxs("div", { className: "mx-auto grid min-h-[calc(100vh-2rem)] w-full min-w-0 max-w-6xl content-center gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-stretch", children: [
      jsxs("header", { className: "w-full min-w-0 space-y-3 lg:flex lg:h-full lg:flex-col", children: [
        jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5 lg:flex-1 lg:flex-col", children: [
          jsxs("div", { className: "min-w-0", children: [
            jsx("p", { className: "text-xs font-medium va-accent-text", children: replayMode ? "إعادة تشغيل المعالج" : "الإصدار الأول" }),
            jsx("h2", { className: "mt-2 text-lg font-bold text-white", children: "أرشيف الفيديو" }),
            jsx("p", { className: "mt-2 max-w-2xl text-xs leading-6 text-gray-400", children: "كل خطوة تظهر كشريحة واحدة واضحة، مع تقدم أفقي واختصارات تناسب العمل من الهاتف أو لوحة المفاتيح." })
          ] }),
          jsx("div", {
            className: "hidden rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-6 text-gray-500 lg:block",
            children: "يدعم التشغيل المحلي والخادم السحابي، مع تفضيل واضح لتحديثات نسخة الخادم أثناء الإعداد."
          }),
          replayMode && jsx("button", {
            type: "button",
            onClick: onCancel,
            className: "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white",
            "aria-label": "إغلاق معالج البداية",
            children: jsx(X, { className: "h-5 w-5" })
          })
        ] }),
        jsx(OnboardingProgressRail, {
          steps,
          activeStepIndex,
          onStepClick: (index) => moveToStepIndex(index, index > activeStepIndex ? "next" : "previous", { validate: false })
        })
      ] }),
      jsxs("section", {
        className: "va-onboarding-panel flex w-full min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b1626]/95 shadow-2xl shadow-black/20",
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
                  renderStepBody(),
                  error && jsxs("div", { className: "mt-5 flex items-start gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-red-100", role: "alert", children: [
                    jsx(TriangleAlert, { className: "mt-0.5 h-5 w-5 shrink-0" }),
                    jsx("p", { className: "text-sm leading-7", children: error })
                  ] })
                ]
              })
            })
          }),
          jsxs("footer", { className: "sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0b1626]/95 p-3 backdrop-blur sm:p-5", children: [
            jsx(SecondaryButton, {
              onClick: goBack,
              disabled: isFirstStep,
              children: jsxs("span", { className: "inline-flex items-center gap-2", children: [
                jsx(ChevronRight, { className: "h-4 w-4" }),
                "السابق"
              ] })
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
