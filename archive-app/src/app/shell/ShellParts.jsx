import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Compass,
  Database,
  Download,
  Command,
  FolderOpen,
  History as HistoryIcon,
  Home,
  Info,
  KeyRound,
  Lock,
  LogIn,
  Redo2,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Tags,
  Undo2,
  Upload,
  Video,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import { createPortal } from "react-dom";
import { useAppStore, useAuthStore } from "../../stores/index.js";
import { PasswordField } from "../../components/common/PasswordField.jsx";
import { buildVideoItemCommands, filterCommandPaletteCommands, groupCommandPaletteCommands } from "../../components/common/commandPaletteViewModel.js";
import { undoRedoManager as sharedUndoRedoManager, SimpleUndoRedoManager } from "../../components/common/undoManager.js";
import { InsightPanel, SkeletonBlock, WorkflowStepper } from "../../components/ui/V1Primitives.jsx";

const STARTUP_STEPS = [
  { id: "environment", label: "فحص البيئة" },
  { id: "data", label: "تحميل البيانات" },
  { id: "auth", label: "استعادة الجلسة" },
  { id: "route", label: "تطبيق الرابط الحالي" }
];

function nowIso() {
  return new Date().toISOString();
}

export function createStartupProgressState(overrides = {}) {
  return {
    running: true,
    steps: STARTUP_STEPS,
    currentStepId: STARTUP_STEPS[0].id,
    progress: 1,
    warnings: [],
    fatalError: null,
    ...overrides
  };
}

export async function runStartupSequence({ onStep, loadAllData, initAuth } = {}) {
  const steps = STARTUP_STEPS.map((step) => ({ ...step, status: "pending" }));
  const warnings = [];

  const report = (index, status = "running", extra = {}) => {
    const currentStep = steps[index] || steps[steps.length - 1];
    steps.forEach((step, stepIndex) => {
      if (stepIndex < index) step.status = "done";
      if (stepIndex === index) step.status = status;
    });
    onStep?.({
      running: status !== "done" || index < steps.length - 1,
      steps: [...steps],
      currentStepId: currentStep?.id,
      progress: Math.round(((index + (status === "done" ? 1 : 0.35)) / steps.length) * 100),
      warnings: [...warnings],
      fatalError: null,
      ...extra
    });
  };

  try {
    report(0);
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB غير متاح في هذا المتصفح.");
    }
    report(0, "done");

    report(1);
    await loadAllData?.();
    report(1, "done");

    report(2);
    await initAuth?.();
    report(2, "done");

    report(3);
    report(3, "done", { running: false, progress: 100 });
    return { ok: true, limitedMode: false, steps, warnings, fatalError: null };
  } catch (error) {
    const fatalError = {
      message: error?.message || "تعذر بدء التطبيق",
      userMessage: error?.message || "حدث خطأ أثناء تهيئة التطبيق.",
      at: nowIso()
    };
    onStep?.({
      running: false,
      steps,
      currentStepId: steps.find((step) => step.status === "running")?.id || steps[0].id,
      progress: 100,
      warnings,
      fatalError
    });
    return { ok: false, limitedMode: true, steps, warnings, fatalError };
  }
}

export { SimpleUndoRedoManager };
export const undoRedoManager = sharedUndoRedoManager;

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[AppErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div dir="rtl" role="alert" aria-live="assertive" className="m-6 rounded-2xl border border-red-500/25 bg-red-500/10 p-6 text-right text-red-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold">حدث خطأ في هذه الشاشة</h2>
            <p className="mt-2 text-sm leading-7 text-red-100/80">
              لم يتم تطبيق أي تغيير غير مكتمل. أعد تحميل الصفحة أو افتح فحص النظام إذا تكرر الخطأ.
            </p>
            <pre dir="ltr" className="mt-4 max-h-40 overflow-auto rounded-xl bg-black/25 p-3 text-left text-xs text-red-50">
              {this.state.error?.message || String(this.state.error)}
            </pre>
          </div>
        </div>
      </div>
    );
  }
}

export function DashboardSkeleton() {
  return (
    <div dir="rtl" className="space-y-5 p-6">
      <div className="va-skeleton h-24 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="va-skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="va-skeleton h-96 rounded-2xl" />
        <div className="va-skeleton h-96 rounded-2xl" />
      </div>
    </div>
  );
}

export function SplashScreen({ steps = STARTUP_STEPS, currentStepId, progress = 1, warnings = [], fatalError, onOpenDiagnostics }) {
  const currentStep = steps.find((step) => step.id === currentStepId) || steps[0];
  const completedStepIds = steps.filter((step) => step.status === "done").map((step) => step.id);
  return (
    <main dir="rtl" className="va-onboarding-shell flex min-h-screen items-center justify-center bg-[#07111f] p-6 text-right text-white">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="va-onboarding-panel w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0b1626]/95 p-7 shadow-2xl shadow-black/30"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl va-accent-bg-soft va-accent-text-on-soft">
            <Sparkles className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">أرشيف الفيديو</h1>
            <p className="mt-1 text-sm text-slate-400">نجهز البيئة المحلية ونفتح آخر حالة آمنة للتطبيق.</p>
          </div>
        </div>

        <div className="mt-7">
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="font-semibold text-slate-100">{currentStep?.label || "بدء التشغيل"}</span>
            <span dir="ltr" className="font-mono va-accent-text-on-soft">{Math.max(0, Math.min(100, Math.round(progress)))}%</span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
            dir="rtl"
            role="progressbar"
            aria-valuenow={Math.max(0, Math.min(100, Math.round(progress)))}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="تقدم بدء التشغيل"
          >
            <div className="h-full rounded-full va-accent-bg transition-all duration-300" style={{ width: `${Math.max(4, Math.min(100, progress))}%` }} />
          </div>
        </div>

        <WorkflowStepper steps={steps} activeStepId={currentStepId} completedStepIds={completedStepIds} className="mt-6 sm:grid-cols-4" compact />

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <InsightPanel
            icon={<Database className="h-5 w-5" />}
            title="بياناتك محلية"
            description="يتم تحميل IndexedDB على هذا الجهاز فقط، ويمكنك نقل الأرشيف لاحقًا من مركز البيانات."
            className="p-4"
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-sm font-semibold text-slate-200">نجهّز الواجهة التالية</p>
            <div className="mt-3 space-y-2">
              <SkeletonBlock className="h-3 w-11/12" />
              <SkeletonBlock className="h-3 w-8/12" />
              <SkeletonBlock className="h-8 w-full" />
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div role="alert" className="alert alert-warning mt-5 block rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
            {warnings.slice(0, 2).map((warning) => <p key={warning.id || warning.message}>{warning.message || warning}</p>)}
          </div>
        )}

        {fatalError && (
          <button type="button" onClick={onOpenDiagnostics} className="mt-5 rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100">
            فتح فحص النظام
          </button>
        )}
      </motion.section>
    </main>
  );
}

export function StartupRecoveryScreen({ report, onRetry, onOpenDiagnostics }) {
  const message = report?.fatalError?.userMessage || report?.fatalError?.message || "تعذر بدء التطبيق بشكل كامل.";
  return (
    <main dir="rtl" className="va-onboarding-shell flex min-h-screen items-center justify-center bg-[#07111f] p-6 text-right text-white">
      <section className="va-onboarding-panel w-full max-w-xl rounded-3xl border border-red-500/25 bg-[#0b1626] p-7">
        <ShieldAlert className="h-10 w-10 text-red-300" />
        <h1 className="mt-4 text-2xl font-bold">شاشة استرداد بدء التشغيل</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">{message}</p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-7 text-slate-300">
          بياناتك لا تُنقل إلى أي خادم. إذا استمر الخطأ، افتح فحص النظام لمعرفة حالة IndexedDB والمساحة المتاحة.
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onOpenDiagnostics} className="btn btn-primary">
            فتح فحص النظام
          </button>
          <button type="button" onClick={onRetry} className="va-secondary-button rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200">
            إعادة المحاولة
          </button>
        </div>
      </section>
    </main>
  );
}

export function LockScreen() {
  const unlockApp = useAppStore((state) => state.unlockApp);
  const showToast = useAppStore((state) => state.showToast);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const ok = await unlockApp?.(password);
      if (!ok) {
        setError("كلمة المرور غير صحيحة.");
        return;
      }
      showToast?.("تم فتح التطبيق", "success");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main dir="rtl" className="va-auth-shell flex min-h-screen items-center justify-center bg-[#07111f] p-6 text-right text-white">
      <form onSubmit={submit} className="va-auth-card w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1626] p-7">
        <Lock className="h-10 w-10 va-accent-text" />
        <h1 className="mt-4 text-2xl font-bold">التطبيق مقفل</h1>
        <p className="mt-2 text-sm text-slate-400">أدخل كلمة المرور الرئيسية للمتابعة.</p>
        <PasswordField
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-5"
          autoComplete="current-password"
          placeholder="كلمة المرور"
        />
        {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
        <button type="submit" className="btn btn-primary mt-5 w-full">
          فتح
        </button>
      </form>
    </main>
  );
}

export function LoginScreen() {
  const users = useAppStore((state) => state.users || []);
  const skipPasswordSetup = useAppStore((state) => state.skipPasswordSetup);
  const { login, authError, isLoading } = useAuthStore();
  const [username, setUsername] = React.useState(() => users.find((user) => user.username === "admin")?.username || users[0]?.username || "admin");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);

  const submit = async (event) => {
    event.preventDefault();
    await login?.(username, password, rememberMe);
  };

  const openOnboarding = () => {
    // From the login screen a user already exists, so authState is "login",
    // not "setup". The app auto-closes a "startup" wizard whenever
    // authState !== "setup", which made this button appear to do nothing.
    // "replay" is the manual-open mode the app keeps open regardless of
    // authState, so the wizard actually shows.
    window.dispatchEvent(new CustomEvent("videoarchive:onboarding-open", { detail: { mode: "replay" } }));
  };

  return (
    <main dir="rtl" className="va-onboarding-shell va-auth-shell flex min-h-screen items-center justify-center bg-[#07111f] p-6 text-right text-white">
      <section className="va-onboarding-panel va-auth-card grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1626] shadow-2xl shadow-black/30 md:grid-cols-[0.9fr_1.1fr]">
        <aside className="va-accent-bg-soft p-7">
          <Sparkles className="h-11 w-11 va-accent-text-on-soft" />
          <h1 className="mt-5 text-3xl font-bold">أرشيف الفيديو</h1>
          <p className="mt-3 text-sm leading-7 va-accent-text-on-soft">
            دخول سريع وآمن إلى الأرشيف المحلي، مع بقاء بياناتك على هذا الجهاز.
          </p>
          <button type="button" onClick={openOnboarding} className="mt-6 rounded-xl border va-accent-border px-4 py-2 text-sm font-semibold va-accent-text-on-soft">
            تشغيل معالج البداية
          </button>
        </aside>
        <form onSubmit={submit} className="p-7">
          <div className="flex items-center gap-3">
            <LogIn className="h-6 w-6 va-accent-text" />
            <h2 className="text-2xl font-bold">تسجيل الدخول</h2>
          </div>
          <label className="mt-6 block text-sm text-slate-300">
            المستخدم
            <select value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white">
              {users.length ? users.filter((user) => user.isActive !== false).map((user) => (
                <option key={user.id || user.username} value={user.username}>{user.displayName || user.username}</option>
              )) : <option value="admin">admin</option>}
            </select>
          </label>
          <div className="mt-4">
            <span className="block text-sm text-slate-300">كلمة المرور</span>
            <PasswordField
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2"
              autoComplete="current-password"
            />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 accent-emerald-500" />
            تذكر الجلسة على هذا الجهاز
          </label>
          {authError && <p role="alert" className="alert alert-error mt-4 block rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">{authError}</p>}
          <button type="submit" disabled={isLoading} className="btn btn-primary mt-6 w-full">
            {isLoading ? "جار التحقق..." : "دخول"}
          </button>
          {users.length === 0 && (
            <button type="button" onClick={() => skipPasswordSetup?.()} className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">
              البدء السريع بدون كلمة مرور
            </button>
          )}
        </form>
      </section>
    </main>
  );
}

const TOAST_ICON = {
  success: <CheckCircle2 className="mt-0.5 h-5 w-5 va-accent-text" />,
  error: <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />,
  warning: <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />,
  info: <Info className="mt-0.5 h-5 w-5 text-sky-300" />
};

const TOAST_PROGRESS_COLOR = {
  success: "bg-[var(--va-action)]",
  error: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-sky-400"
};

export function ToastNotification() {
  const notifications = useAppStore((state) => state.notifications || []);
  const dismissNotification = useAppStore((state) => state.dismissNotification);
  const topItems = notifications.slice(0, 3);
  return createPortal(
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] left-1/2 z-[9990] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 text-right md:bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] lg:left-4 lg:translate-x-0"
    >
      <AnimatePresence initial={false}>
        {topItems.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: -12, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ duration: 0.2 }}
            role={notification.type === "error" ? "alert" : undefined}
            className="pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-[var(--color-bg-surface,#0b1626)]/95 text-white shadow-2xl shadow-black/25 backdrop-blur"
            layout
          >
            <div className="flex items-start gap-3 p-4">
              {TOAST_ICON[notification.type] || TOAST_ICON.info}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{notification.title || "تنبيه"}</p>
                  {notification.count > 1 && (
                    <span className="rounded-full border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white/70">
                      ×{notification.count}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-300">{notification.message}</p>
                {notification.action && (
                  <button
                    type="button"
                    onClick={() => {
                      try { notification.action.run(); } catch (error) { console.warn("[toast action]", error); }
                      if (notification.action.dismissOnRun !== false) dismissNotification?.(notification.id);
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[color-mix(in_srgb,var(--va-action)_40%,transparent)] bg-[color-mix(in_srgb,var(--va-action)_18%,transparent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[color-mix(in_srgb,var(--va-action)_28%,transparent)]"
                  >
                    {notification.action.label}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => dismissNotification?.(notification.id)} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="إغلاق">
                <X className="h-4 w-4" />
              </button>
            </div>
            {typeof notification.progress === "number" && (
              <div className="h-1 w-full bg-white/10">
                <div
                  className={`h-full transition-all duration-300 ${TOAST_PROGRESS_COLOR[notification.type] || TOAST_PROGRESS_COLOR.info}`}
                  style={{ width: `${notification.progress}%` }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

export function CommandPalette({ open, onOpenChange, onOpenShortcuts, onOpenQuickAdd }) {
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);
  const setSelectedItemId = useAppStore((state) => state.setSelectedItemId);
  const videoItems = useAppStore((state) => state.videoItems || []);
  const projects = useAppStore((state) => state.projects || []);
  const virtualCollections = useAppStore((state) => state.virtualCollections || []);
  const settings = useAppStore((state) => state.settings || {});
  const updateSettings = useAppStore((state) => state.updateSettings);
  const recentCommandIds = settings.ui?.recentCommands || [];
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef(null);

  const openItem = React.useCallback((item) => {
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  }, [setCurrentPage, setSelectedItemId]);

  const navigationCommands = React.useMemo(() => [
    { id: "dashboard", label: "مركز التحكم", detail: "العودة للبداية اليومية", icon: Home, kind: "page", group: "page", run: () => setCurrentPage?.("dashboard") },
    { id: "archive", label: "الأرشيف", detail: "تصفح المواد والفلاتر", icon: FolderOpen, kind: "page", group: "page", run: () => setCurrentPage?.("archive") },
    { id: "discover", label: "الاكتشاف", detail: "استكشف الرائج والعشوائي والمنسي", icon: Compass, kind: "page", group: "page", run: () => setCurrentPage?.("discover") },
    { id: "search", label: "البحث المتقدم", detail: "بحث لحظي مع فلاتر تفصيلية", icon: Search, kind: "page", group: "page", run: () => setCurrentPage?.("search") },
    { id: "projects", label: "المشاريع", detail: "مونتاج ومهام وقصاصات", icon: FolderOpen, kind: "page", group: "page", run: () => setCurrentPage?.("projects") },
    { id: "types", label: "الأنواع والحقول", detail: "إدارة نماذج المواد", icon: Tags, kind: "page", group: "page", run: () => setCurrentPage?.("types") },
    { id: "add", label: "إضافة فيديو (نموذج كامل)", detail: "إنشاء مادة أرشيفية جديدة", icon: Sparkles, kind: "page", group: "page", run: () => setCurrentPage?.("add") },
    { id: "backup", label: "مركز البيانات", detail: "استيراد وتصدير ونقل", icon: Database, kind: "page", group: "page", run: () => setCurrentPage?.("backup") },
    { id: "history", label: "سجل التغييرات", detail: "آخر العمليات على الأرشيف", icon: HistoryIcon, kind: "page", group: "page", run: () => setCurrentPage?.("history") },
    { id: "help", label: "المساعدة", detail: "فتح مركز المعرفة", icon: Info, kind: "page", group: "page", run: () => setCurrentPage?.("help") }
  ], [onOpenShortcuts, setCurrentPage]);

  const actionCommands = React.useMemo(() => [
    { id: "quick-add", label: "إنشاء سريع", detail: "أنشئ مادة أو نوعاً أو مصطلحاً من أي صفحة (Alt+A)", icon: Sparkles, kind: "action", group: "action", run: () => onOpenQuickAdd?.() },
    { id: "import-data", label: "استيراد بيانات", detail: "فتح مركز البيانات على الاستيراد", icon: Upload, kind: "action", group: "action", run: () => setCurrentPage?.("backup") },
    { id: "export-report", label: "تصدير تقرير", detail: "فتح مركز البيانات على التصدير", icon: Download, kind: "action", group: "action", run: () => setCurrentPage?.("backup") },
    { id: "shortcuts", label: "اختصارات لوحة المفاتيح", detail: "عرض الاختصارات الحالية", icon: Command, kind: "action", group: "action", run: onOpenShortcuts },
    { id: "storage-settings", label: "إعدادات التخزين", detail: "فتح إعدادات البيانات والملفات", icon: Database, kind: "settings", group: "settings", run: () => setCurrentPage?.("settings") },
    { id: "appearance-settings", label: "استوديو المظهر", detail: "فتح إعدادات الواجهة والقوالب", icon: Settings, kind: "settings", group: "settings", run: () => setCurrentPage?.("settings") }
  ], [onOpenQuickAdd, onOpenShortcuts, setCurrentPage]);

  const projectCommands = React.useMemo(() => projects.slice(0, 8).map((project) => ({
    id: `project-${project.id}`,
    label: `افتح مشروع: ${project.name || project.title || "مشروع"}`,
    detail: `${project.items?.length || project.itemIds?.length || 0} مادة مرتبطة`,
    icon: FolderOpen,
    kind: "project",
    group: "project",
    run: () => setCurrentPage?.("projects")
  })), [projects, setCurrentPage]);

  const collectionCommands = React.useMemo(() => virtualCollections.slice(0, 6).map((collection) => ({
    id: `collection-${collection.id}`,
    label: `افتح مجموعة: ${collection.name || "مجموعة"}`,
    detail: collection.type === "smart" ? "مجموعة ذكية" : "مجموعة يدوية",
    icon: FolderOpen,
    kind: "project",
    group: "project",
    run: () => setCurrentPage?.("collections")
  })), [setCurrentPage, virtualCollections]);

  const itemCommands = React.useMemo(
    () => buildVideoItemCommands(videoItems, { query, limit: 6, onOpen: openItem }),
    [openItem, query, videoItems]
  );

  const filtered = React.useMemo(() => {
    if (!query.trim()) {
      const base = [...navigationCommands, ...actionCommands];
      const byId = new Map(base.map((command) => [command.id, command]));
      const recents = recentCommandIds.map((id) => byId.get(id)).filter(Boolean).map((command) => ({ ...command, group: "recent" }));
      const seen = new Set(recents.map((command) => command.id));
      const remaining = base.filter((command) => !seen.has(command.id));
      return [...recents, ...remaining];
    }
    return [
      ...filterCommandPaletteCommands([...navigationCommands, ...actionCommands], query),
      ...filterCommandPaletteCommands([...projectCommands, ...collectionCommands], query),
      ...itemCommands
    ];
  }, [actionCommands, collectionCommands, itemCommands, navigationCommands, projectCommands, query, recentCommandIds]);

  const grouped = React.useMemo(() => groupCommandPaletteCommands(filtered), [filtered]);
  const indexedGroups = React.useMemo(() => {
    let index = 0;
    return grouped.map((group) => ({
      ...group,
      items: group.items.map((command) => ({ command, index: index++ }))
    }));
  }, [grouped]);

  React.useEffect(() => {
    if (!open) setQuery("");
    setActiveIndex(0);
  }, [open]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector(`[data-command-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered, open]);

  const rememberCommand = React.useCallback((commandId) => {
    if (!updateSettings || !commandId) return;
    const next = [commandId, ...recentCommandIds.filter((id) => id !== commandId)].slice(0, 5);
    updateSettings({ ui: { ...(settings.ui || {}), recentCommands: next } });
  }, [recentCommandIds, settings.ui, updateSettings]);

  const runCommand = React.useCallback((command) => {
    if (!command) return;
    if (command.kind !== "item") setSelectedItemId?.(null);
    if (command.kind !== "item") rememberCommand(command.id);
    command.run?.();
    onOpenChange?.(false);
  }, [onOpenChange, rememberCommand, setSelectedItemId]);

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(filtered.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runCommand(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange?.(false);
    }
  };

  if (!open) return null;

  const isEmpty = !filtered.length;
  const showRecentLabel = !query.trim() && recentCommandIds.length > 0;

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[9980] bg-black/60 p-4 text-right backdrop-blur-sm" onMouseDown={() => onOpenChange?.(false)}>
      <motion.section
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="mx-auto mt-4 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[var(--color-bg-surface,#0b1626)] text-white shadow-2xl sm:mt-16"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="لوحة الأوامر"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-5 w-5 text-[var(--va-action)]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب أمرًا أو صفحة، أو ابحث عن فيديو..."
            className="min-h-11 flex-1 bg-transparent text-right outline-none placeholder:text-slate-500"
            aria-label="بحث الأوامر"
            aria-autocomplete="list"
          />
          <button type="button" onClick={() => onOpenChange?.(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div ref={listRef} className="max-h-[min(460px,calc(100dvh-12rem))] overflow-auto p-2" role="listbox">
          {indexedGroups.map((group) => (
            <section key={group.id} className="py-1">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{group.label}</p>
              {group.items.map(({ command, index }) => {
                const Icon = command.icon || (command.kind === "item" ? Video : Command);
                const active = index === activeIndex;
                const badge = command.kind === "item" ? "فيديو" : command.kind === "project" ? "مشروع" : command.kind === "settings" ? "إعداد" : command.kind === "action" ? "إجراء" : "";
                return (
                  <button
                    key={command.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-command-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runCommand(command)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-right transition-colors ${active ? "bg-[color-mix(in_srgb,var(--va-action)_18%,transparent)]" : "hover:bg-white/[0.05]"}`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-[var(--va-action)]"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{command.label}</span>
                      <span className="block truncate text-xs text-slate-400">{command.detail}</span>
                    </span>
                    {badge && (
                      <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">{badge}</span>
                    )}
                  </button>
                );
              })}
            </section>
          ))}
          {isEmpty && <p className="p-6 text-center text-sm text-slate-400">لا توجد نتائج مطابقة.</p>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-2 text-[10px] text-slate-500">
          <span>↑ ↓ للتنقل · Enter للاختيار · Esc للإغلاق</span>
          <span>{filtered.length} نتيجة</span>
        </div>
      </motion.section>
    </div>,
    document.body
  );
}

export function UndoRedoBar() {
  const [snapshot, setSnapshot] = React.useState(() => undoRedoManager.getSnapshot());
  React.useEffect(() => undoRedoManager.subscribe(() => setSnapshot(undoRedoManager.getSnapshot())), []);
  if (!snapshot.canUndo && !snapshot.canRedo) return null;
  return (
    <div
      dir="rtl"
      className="va-surface-muted fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] right-4 z-[9970] flex items-center gap-1 rounded-2xl border p-1.5 text-sm shadow-xl md:bottom-4 lg:right-[296px]"
      role="group"
      aria-label="تراجع وإعادة"
    >
      <button
        type="button"
        disabled={!snapshot.canUndo}
        onClick={() => undoRedoManager.undo()}
        title="تراجع"
        aria-label="تراجع"
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-medium text-gray-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Undo2 className="h-4 w-4" aria-hidden="true" />
        تراجع
      </button>
      <span aria-hidden="true" className="h-5 w-px bg-white/10" />
      <button
        type="button"
        disabled={!snapshot.canRedo}
        onClick={() => undoRedoManager.redo()}
        title="إعادة"
        aria-label="إعادة"
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-medium text-gray-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Redo2 className="h-4 w-4" aria-hidden="true" />
        إعادة
      </button>
    </div>
  );
}

export function StatusBar() {
  const backgroundOperation = useAppStore((state) => state.backgroundOperation);
  if (!backgroundOperation) return null;
  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="va-surface-muted fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] right-1/2 z-[9960] max-w-[92vw] translate-x-1/2 truncate rounded-full border px-4 py-2 text-sm text-gray-200 shadow-xl md:bottom-4"
    >
      {backgroundOperation.label || "عملية تعمل في الخلفية"}
    </div>
  );
}

export function ForceChangePasswordDialog() {
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword);
  const forceChangePassword = useAuthStore((state) => state.forceChangePassword);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  if (!mustChangePassword) return null;

  const submit = async (event) => {
    event.preventDefault();
    const ok = await forceChangePassword?.(password);
    if (!ok) setError("تعذر تغيير كلمة المرور. استخدم كلمة مرور أقوى.");
  };

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/70 p-4 text-right text-white">
      <form onSubmit={submit} className="va-surface-muted w-full max-w-md rounded-3xl border p-6">
        <KeyRound className="h-9 w-9 va-accent-text" />
        <h2 className="mt-4 text-xl font-bold">تغيير كلمة المرور مطلوب</h2>
        <PasswordField
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-5"
          autoComplete="new-password"
          placeholder="كلمة المرور الجديدة"
        />
        {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
        <button type="submit" className="btn btn-primary mt-5 w-full">حفظ كلمة المرور</button>
      </form>
    </div>,
    document.body
  );
}

function createTourSteps(role = "viewer") {
  if (role === "admin") {
    return [
      { title: "ربط المخزن", body: "ابدأ من الإعدادات أو مركز البيانات: افحص SQL وFileStore وAI قبل دخول الفريق." },
      { title: "رفع وفهرسة", body: "استخدم Uploader لإنشاء مواد من الملفات، ثم راقب مهام الوسائط والصحة اليومية." },
      { title: "توصيف الفريق", body: "راجع الأنواع والقاموس والوسوم حتى يستخدم المحررون لغة موحدة." },
      { title: "المشاركة والتصدير", body: "استخدم مركز البيانات للتقارير، EDL/NLE، النسخ الاحتياطي، وحزم النقل الآمنة." }
    ];
  }
  if (role === "editor") {
    return [
      { title: "إنشاء سريع", body: "ابدأ بمادة أو مصطلح أو وسم من أي صفحة، ثم افتح التفاصيل عند الحاجة." },
      { title: "رفع وتفريغ", body: "ارفع الملفات، شغّل التفريغ، واستخدم البحث داخل النص للوصول إلى المقطع." },
      { title: "توصيف يومي", body: "استخدم @ للقاموس و# للوسوم، وراجع فجوات التوصيف قبل التسليم." },
      { title: "مونتاج ومشاركة", body: "أضف المادة إلى مشروع، ابن rough cuts، ثم صدّر JSON/EDL أو شارك رابطاً محدود النطاق." }
    ];
  }
  return [
    { title: "البحث والمراجعة", body: "ابدأ من الأرشيف أو البحث المتقدم للوصول إلى المادة والانتقال إلى مقاطع التفريغ." },
    { title: "التعليقات والذكر", body: "أضف تعليقاً أو اذكر زميلاً عند وجود ملاحظة، وستظهر الإشارة في مركز الإشعارات." },
    { title: "التصدير المسموح", body: "استخدم التقارير أو مركز البيانات للملفات المسموحة حسب صلاحيتك دون تعديل بنية الأرشيف." }
  ];
}

export function V1ProductTour({ open, role = "viewer", onComplete, onSkip }) {
  const [index, setIndex] = React.useState(0);
  const tourSteps = React.useMemo(() => createTourSteps(role), [role]);
  React.useEffect(() => {
    if (open) setIndex(0);
  }, [open, role]);
  if (!open) return null;
  const step = tourSteps[index] || tourSteps[0];
  const last = index >= tourSteps.length - 1;
  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[9992] flex items-end justify-center bg-black/55 p-4 text-right text-white backdrop-blur-sm sm:items-center">
      <section className="va-surface-muted w-full max-w-lg rounded-3xl border p-6 shadow-2xl">
        <p className="text-xs font-semibold va-accent-text">جولة تشغيل {index + 1} / {tourSteps.length}</p>
        <h2 className="mt-3 text-2xl font-bold">{step.title}</h2>
        <p className="mt-3 text-sm leading-7 text-gray-300">{step.body}</p>
        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <button type="button" onClick={onSkip} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300">تخطي</button>
          <button type="button" onClick={() => last ? onComplete?.() : setIndex((value) => value + 1)} className="btn btn-primary">
            {last ? "إنهاء الجولة" : "التالي"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
