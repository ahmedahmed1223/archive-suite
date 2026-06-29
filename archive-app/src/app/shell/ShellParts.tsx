import {
  AlertTriangle,
  Archive,
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
  Inbox,
  KeyRound,
  Link2,
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
import { CORE_UI_TOUR_ITEMS, ONBOARDING_SHORTCUTS } from "../../features/onboarding/flow.js";
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

export function createStartupProgressState(overrides: any = {}) {
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

export async function runStartupSequence({ onStep, loadAllData, initAuth, requiresIndexedDb = true }: any = {}) {
  const steps = STARTUP_STEPS.map((step: any) => ({ ...step, status: "pending" }));
  const warnings: any[] = [];

  const report = (index: any, status: any = "running", extra: any = {}) => {
    const currentStep = steps[index] || steps[steps.length - 1];
    steps.forEach((step: any, stepIndex: any) => {
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
    if (requiresIndexedDb && typeof indexedDB === "undefined") {
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
  } catch (error: any) {
    const fatalError = {
      message: error?.message || "تعذر بدء التطبيق",
      userMessage: error?.message || "حدث خطأ أثناء تهيئة التطبيق.",
      at: nowIso()
    };
    onStep?.({
      running: false,
      steps,
      currentStepId: steps.find((step: any) => step.status === "running")?.id || steps[0].id,
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
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { error };
  }

  componentDidCatch(error: any, info: any) {
    console.error("[AppErrorBoundary]", error, info);
  }

  render() {
    if (!(this.state as any).error) return (this.props as any).children;
    return (
      <div
        dir="rtl"
        role="alert"
        aria-live="assertive"
        className="m-6 rounded-[var(--va-radius-xl)] border border-[color-mix(in_oklab,var(--va-status-danger)_32%,transparent)] bg-[color-mix(in_oklab,var(--va-status-danger)_10%,var(--va-surface))] p-6 text-start text-[var(--va-text)]"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-[var(--va-status-danger)]" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold">حدث خطأ في هذه الشاشة</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--va-text-2)]">
              لم يتم تطبيق أي تغيير غير مكتمل. أعد تحميل الصفحة أو افتح فحص النظام إذا تكرر الخطأ.
            </p>
            <pre dir="ltr" className="mt-4 max-h-40 overflow-auto rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-bg)] p-3 text-left text-xs text-[var(--va-text-2)]">
              {(this.state as any).error?.message || String((this.state as any).error)}
            </pre>
          </div>
        </div>
      </div>
    );
  }
}

export function DashboardSkeleton() {
  const block = "animate-pulse rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)]";
  return (
    <div dir="rtl" className="space-y-5 p-6" aria-hidden="true">
      <div className={`${block} h-24`} />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_: any, index: any) => (
          <div key={index} className={`${block} h-32`} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className={`${block} h-96`} />
        <div className={`${block} h-96`} />
      </div>
    </div>
  );
}

export function SplashScreen({ steps = STARTUP_STEPS, currentStepId, progress = 1, warnings = [], fatalError, onOpenDiagnostics }: any) {
  const currentStep = steps.find((step: any) => step.id === currentStepId) || steps[0];
  const completedStepIds = steps.filter((step: any) => step.status === "done").map((step: any) => step.id);
  return (
    <main dir="rtl" className="va-onboarding-shell flex min-h-screen items-center justify-center bg-[var(--va-bg)] p-6 text-start text-[var(--va-text)]">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="va-onboarding-panel w-full max-w-3xl rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-7 shadow-[var(--va-elev-popover)]"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-[var(--va-radius-lg)] va-accent-bg-soft va-accent-text-on-soft">
            <Sparkles className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">أرشيف الفيديو</h1>
            <p className="mt-1 text-sm text-[var(--va-text-muted)]">نجهز البيئة المحلية ونفتح آخر حالة آمنة للتطبيق.</p>
          </div>
        </div>

        <div className="mt-7">
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="font-semibold text-[var(--va-text)]">{currentStep?.label || "بدء التشغيل"}</span>
            <span dir="ltr" className="font-mono va-accent-text-on-soft">{Math.max(0, Math.min(100, Math.round(progress)))}%</span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--va-surface-2)]"
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
          <div className="rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4">
            <p className="text-sm font-semibold text-[var(--va-text)]">نجهّز الواجهة التالية</p>
            <div className="mt-3 space-y-2">
              <SkeletonBlock className="h-3 w-11/12" />
              <SkeletonBlock className="h-3 w-8/12" />
              <SkeletonBlock className="h-8 w-full" />
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div role="alert" className="alert alert-warning mt-5 block rounded-[var(--va-radius-md)] border border-[color-mix(in_oklab,var(--va-status-warning)_30%,transparent)] bg-[color-mix(in_oklab,var(--va-status-warning)_12%,var(--va-surface))] p-4 text-sm text-[var(--va-text)]">
            {warnings.slice(0, 2).map((warning: any) => <p key={warning.id || warning.message}>{warning.message || warning}</p>)}
          </div>
        )}

        {fatalError && (
          <button type="button" onClick={onOpenDiagnostics} className="mt-5 rounded-[var(--va-radius-md)] border border-[color-mix(in_oklab,var(--va-status-danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--va-status-danger)_14%,var(--va-surface))] px-4 py-2 text-sm font-semibold text-[var(--va-status-danger)] transition-colors hover:bg-[color-mix(in_oklab,var(--va-status-danger)_20%,var(--va-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--va-status-danger)_55%,transparent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]">
            فتح فحص النظام
          </button>
        )}
      </motion.section>
    </main>
  );
}

export function StartupRecoveryScreen({ report, onRetry, onOpenDiagnostics }: any) {
  const message = report?.fatalError?.userMessage || report?.fatalError?.message || "تعذر بدء التطبيق بشكل كامل.";
  return (
    <main dir="rtl" className="va-onboarding-shell flex min-h-screen items-center justify-center bg-[var(--va-bg)] p-6 text-start text-[var(--va-text)]">
      <section className="va-onboarding-panel w-full max-w-xl rounded-[var(--va-radius-xl)] border border-[color-mix(in_oklab,var(--va-status-danger)_28%,transparent)] bg-[var(--va-elevated)] p-7 shadow-[var(--va-elev-2)]">
        <ShieldAlert className="h-10 w-10 text-[var(--va-status-danger)]" />
        <h1 className="mt-4 text-2xl font-bold">شاشة استرداد بدء التشغيل</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--va-text-2)]">{message}</p>
        <div className="mt-4 rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 text-sm leading-7 text-[var(--va-text-2)]">
          بياناتك لا تُنقل إلى أي خادم. إذا استمر الخطأ، افتح فحص النظام لمعرفة حالة IndexedDB والمساحة المتاحة.
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onOpenDiagnostics} className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--va-radius-md)] border border-transparent bg-emerald-500 px-4 text-sm font-medium text-[var(--va-text-inverse)] transition-colors hover:bg-emerald-600 active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]">
            فتح فحص النظام
          </button>
          <button type="button" onClick={onRetry} className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--va-radius-md)] border border-transparent bg-transparent px-4 text-sm font-medium text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]">
            إعادة المحاولة
          </button>
        </div>
      </section>
    </main>
  );
}

export function LockScreen() {
  const unlockApp = useAppStore((state: any) => state.unlockApp);
  const showToast = useAppStore((state: any) => state.showToast);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const submit = async (event: any) => {
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
    <main dir="rtl" className="va-auth-shell flex min-h-screen items-center justify-center bg-[var(--va-bg)] p-6 text-start text-[var(--va-text)]">
      <form onSubmit={submit} className="va-auth-card w-full max-w-md rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-7 shadow-[var(--va-elev-2)]">
        <Lock className="h-10 w-10 va-accent-text" />
        <h1 className="mt-4 text-2xl font-bold">التطبيق مقفل</h1>
        <p className="mt-2 text-sm text-[var(--va-text-muted)]">أدخل كلمة المرور الرئيسية للمتابعة.</p>
        <PasswordField
          autoFocus
          value={password}
          onChange={(event: any) => setPassword(event.target.value)}
          className="mt-5"
          autoComplete="current-password"
          placeholder="كلمة المرور"
        />
        {error && <p role="alert" aria-live="assertive" className="mt-3 text-sm text-[var(--va-status-danger)]">{error}</p>}
        <button type="submit" disabled={busy} className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--va-radius-md)] border border-transparent bg-emerald-500 px-4 text-sm font-medium text-[var(--va-text-inverse)] transition-colors hover:bg-emerald-600 active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)] disabled:cursor-not-allowed disabled:opacity-55">
          فتح
        </button>
      </form>
    </main>
  );
}

export function LoginScreen() {
  const users = useAppStore((state: any) => state.users || []);
  const skipPasswordSetup = useAppStore((state: any) => state.skipPasswordSetup);
  const { login, authError, isLoading } = useAuthStore();
  const [username, setUsername] = React.useState(() => users.find((user: any) => user.username === "admin")?.username || users[0]?.username || "admin");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);

  const submit = async (event: any) => {
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
    <main dir="rtl" className="va-onboarding-shell va-auth-shell flex min-h-screen items-center justify-center bg-[var(--va-bg)] p-6 text-start text-[var(--va-text)]">
      <section className="va-onboarding-panel va-auth-card grid w-full max-w-5xl overflow-hidden rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] shadow-[var(--va-elev-popover)] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="va-accent-bg-soft p-7">
          <Sparkles className="h-11 w-11 va-accent-text-on-soft" />
          <h1 className="mt-5 text-3xl font-bold">أرشيف الفيديو</h1>
          <p className="mt-3 text-sm leading-7 va-accent-text-on-soft">
            دخول سريع وآمن إلى الأرشيف المحلي، مع بقاء بياناتك على هذا الجهاز.
          </p>
          <button type="button" onClick={openOnboarding} className="mt-6 rounded-[var(--va-radius-md)] border va-accent-border px-4 py-2 text-sm font-semibold va-accent-text-on-soft transition-colors hover:bg-[color-mix(in_oklab,var(--va-v1-accent)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]">
            تشغيل معالج البداية
          </button>
        </aside>
        <form onSubmit={submit} className="p-7">
          <div className="flex items-center gap-3">
            <LogIn className="h-6 w-6 va-accent-text" />
            <h2 className="text-2xl font-bold">تسجيل الدخول</h2>
          </div>
          <label className="mt-6 block text-sm text-[var(--va-text-2)]">
            المستخدم
            <select value={username} onChange={(event: any) => setUsername(event.target.value)} className="mt-2 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface)] px-4 py-3 text-[var(--va-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 focus-visible:border-emerald-500/60">
              {users.length ? users.filter((user: any) => user.isActive !== false).map((user: any) => (
                <option key={user.id || user.username} value={user.username}>{user.displayName || user.username}</option>
              )) : <option value="admin">admin</option>}
            </select>
          </label>
          <div className="mt-4">
            <span className="block text-sm text-[var(--va-text-2)]">كلمة المرور</span>
            <PasswordField
              value={password}
              onChange={(event: any) => setPassword(event.target.value)}
              className="mt-2"
              autoComplete="current-password"
            />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-[var(--va-text-2)]">
            <input type="checkbox" checked={rememberMe} onChange={(event: any) => setRememberMe(event.target.checked)} className="h-4 w-4 accent-emerald-500" />
            تذكر الجلسة على هذا الجهاز
          </label>
          {authError && <p role="alert" aria-live="assertive" className="alert alert-error mt-4 block rounded-[var(--va-radius-md)] border border-[color-mix(in_oklab,var(--va-status-danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--va-status-danger)_10%,var(--va-surface))] p-3 text-sm text-[var(--va-status-danger)]">{authError}</p>}
          <button type="submit" disabled={isLoading} className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--va-radius-md)] border border-transparent bg-emerald-500 px-4 text-sm font-medium text-[var(--va-text-inverse)] transition-colors hover:bg-emerald-600 active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)] disabled:cursor-not-allowed disabled:opacity-55">
            {isLoading ? "جار التحقق..." : "دخول"}
          </button>
          {users.length === 0 && (
            <button type="button" onClick={() => skipPasswordSetup?.()} className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface)] px-4 py-3 text-sm text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-elevated)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]">
              البدء السريع بدون كلمة مرور
            </button>
          )}
        </form>
      </section>
    </main>
  );
}

const TOAST_ICON = {
  success: <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--va-status-success)]" />,
  error: <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--va-status-danger)]" />,
  warning: <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--va-status-warning)]" />,
  info: <Info className="mt-0.5 h-5 w-5 text-[var(--va-status-info)]" />
};

const TOAST_PROGRESS_COLOR = {
  success: "bg-[var(--va-status-success)]",
  error: "bg-[var(--va-status-danger)]",
  warning: "bg-[var(--va-status-warning)]",
  info: "bg-[var(--va-status-info)]"
};

export function ToastNotification() {
  const notifications = useAppStore((state: any) => state.notifications || []);
  const dismissNotification = useAppStore((state: any) => state.dismissNotification);
  const topItems = notifications.slice(0, 3);
  return createPortal(
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] start-1/2 z-[var(--va-z-toast)] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 text-start md:bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] lg:start-4 lg:translate-x-0"
    >
      <AnimatePresence initial={false}>
        {topItems.map((notification: any) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: -12, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ duration: 0.2 }}
            role={notification.type === "error" ? "alert" : undefined}
            className="pointer-events-auto overflow-hidden rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] text-[var(--va-text)] shadow-[var(--va-elev-popover)] backdrop-blur"
            layout
          >
            <div className="flex items-start gap-3 p-4">
              {(TOAST_ICON as any)[notification.type] || TOAST_ICON.info}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{notification.title || "تنبيه"}</p>
                  {notification.count > 1 && (
                    <span className="rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--va-text-2)]">
                      ×{notification.count}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-6 text-[var(--va-text-2)]">{notification.message}</p>
                {notification.action && (
                  <button
                    type="button"
                    onClick={() => {
                      try { notification.action.run(); } catch (error: any) { console.warn("[toast action]", error); }
                      if (notification.action.dismissOnRun !== false) dismissNotification?.(notification.id);
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-[var(--va-radius-sm)] border border-[color-mix(in_srgb,var(--va-action)_40%,transparent)] bg-[color-mix(in_srgb,var(--va-action)_18%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--va-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--va-action)_28%,transparent)]"
                  >
                    {notification.action.label}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => dismissNotification?.(notification.id)} className="rounded-[var(--va-radius-sm)] p-1 text-[var(--va-text-muted)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]" aria-label="إغلاق">
                <X className="h-4 w-4" />
              </button>
            </div>
            {typeof notification.progress === "number" && (
              <div className="h-1 w-full bg-[var(--va-surface-2)]">
                <div
                  className={`h-full transition-all duration-300 ${(TOAST_PROGRESS_COLOR as any)[notification.type] || TOAST_PROGRESS_COLOR.info}`}
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

export function CommandPalette({ open, onOpenChange, onOpenShortcuts, onOpenQuickAdd }: any) {
  const setCurrentPage = useAppStore((state: any) => state.setCurrentPage);
  const setSelectedItemId = useAppStore((state: any) => state.setSelectedItemId);
  const videoItems = useAppStore((state: any) => state.videoItems || []);
  const projects = useAppStore((state: any) => state.projects || []);
  const virtualCollections = useAppStore((state: any) => state.virtualCollections || []);
  const settings = useAppStore((state: any) => state.settings || {});
  const updateSettings = useAppStore((state: any) => state.updateSettings);
  const recentCommandIds = settings.ui?.recentCommands || [];
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef(null);

  const openItem = React.useCallback((item: any) => {
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
    { id: "shared-links", label: "روابط المشاركة", detail: "إدارة الروابط التي أنشأتها ونسخها أو إبطالها", icon: Link2, kind: "page", group: "page", run: () => setCurrentPage?.("shared-links") },
    { id: "shared-with-me", label: "المشترك معي", detail: "فتح رابط مشاركة وصل إليك أو العودة لسجل الروابط", icon: Inbox, kind: "page", group: "page", run: () => setCurrentPage?.("shared-with-me") },
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

  const projectCommands = React.useMemo(() => projects.slice(0, 8).map((project: any) => ({
    id: `project-${project.id}`,
    label: `افتح مشروع: ${project.name || project.title || "مشروع"}`,
    detail: `${project.items?.length || project.itemIds?.length || 0} مادة مرتبطة`,
    icon: FolderOpen,
    kind: "project",
    group: "project",
    run: () => setCurrentPage?.("projects")
  })), [projects, setCurrentPage]);

  const collectionCommands = React.useMemo(() => virtualCollections.slice(0, 6).map((collection: any) => ({
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
      const byId = new Map(base.map((command: any) => [command.id, command]));
      const recents = recentCommandIds.map((id: any) => byId.get(id)).filter(Boolean).map((command: any) => ({ ...command, group: "recent" }));
      const seen = new Set(recents.map((command: any) => command.id));
      const remaining = base.filter((command: any) => !seen.has(command.id));
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
    return grouped.map((group: any) => ({
      ...group,
      items: group.items.map((command: any) => ({ command, index: index++ }))
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
    const node = (listRef.current as any)?.querySelector(`[data-command-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered, open]);

  const rememberCommand = React.useCallback((commandId: any) => {
    if (!updateSettings || !commandId) return;
    const next = [commandId, ...recentCommandIds.filter((id: any) => id !== commandId)].slice(0, 5);
    updateSettings({ ui: { ...(settings.ui || {}), recentCommands: next } });
  }, [recentCommandIds, settings.ui, updateSettings]);

  const runCommand = React.useCallback((command: any) => {
    if (!command) return;
    if (command.kind !== "item") setSelectedItemId?.(null);
    if (command.kind !== "item") rememberCommand(command.id);
    command.run?.();
    onOpenChange?.(false);
  }, [onOpenChange, rememberCommand, setSelectedItemId]);

  const handleKeyDown = (event: any) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index: any) => Math.min(filtered.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index: any) => Math.max(0, index - 1));
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
    <div dir="rtl" className="fixed inset-0 z-[var(--va-z-command)] bg-black/55 p-4 text-start backdrop-blur-sm" onMouseDown={() => onOpenChange?.(false)}>
      <motion.section
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="mx-auto mt-4 w-full max-w-2xl overflow-hidden rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] text-[var(--va-text)] shadow-[var(--va-elev-popover)] sm:mt-16"
        onMouseDown={(event: any) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="لوحة الأوامر"
      >
        <div className="flex items-center gap-3 border-b border-[var(--va-border-soft)] px-4 py-3">
          <Search className="h-5 w-5 text-[var(--va-action)]" />
          <input
            autoFocus
            value={query}
            onChange={(event: any) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب أمرًا أو صفحة، أو ابحث عن فيديو..."
            className="min-h-11 flex-1 bg-transparent text-start text-[var(--va-text)] outline-none placeholder:text-[var(--va-text-muted)]"
            aria-label="بحث الأوامر"
            aria-autocomplete="list"
          />
          <button type="button" onClick={() => onOpenChange?.(false)} className="rounded-[var(--va-radius-sm)] p-2 text-[var(--va-text-muted)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div ref={listRef} className="max-h-[min(460px,calc(100dvh-12rem))] overflow-auto p-2" role="listbox">
          {indexedGroups.map((group: any) => (
            <section key={group.id} className="py-1">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--va-text-muted)]">{group.label}</p>
              {group.items.map(({ command, index }: any) => {
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
                    className={`flex w-full items-center gap-3 rounded-[var(--va-radius-lg)] px-4 py-3 text-start transition-colors ${active ? "bg-[color-mix(in_srgb,var(--va-action)_16%,transparent)] text-[var(--va-text)]" : "hover:bg-[var(--va-surface-2)]"}`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? "text-[var(--va-action)]" : "text-[var(--va-text-muted)]"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{command.label}</span>
                      <span className="block truncate text-xs text-[var(--va-text-muted)]">{command.detail}</span>
                    </span>
                    {badge && (
                      <span className="shrink-0 rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-[10px] text-[var(--va-text-2)]">{badge}</span>
                    )}
                  </button>
                );
              })}
            </section>
          ))}
          {isEmpty && <p className="p-6 text-center text-sm text-[var(--va-text-muted)]">لا توجد نتائج مطابقة.</p>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--va-border-soft)] px-4 py-2 text-[10px] text-[var(--va-text-muted)]">
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
  React.useEffect(() => {
    undoRedoManager.subscribe(() => setSnapshot(undoRedoManager.getSnapshot()));
    return undefined;
  }, []);
  if (!snapshot.canUndo && !snapshot.canRedo) return null;
  return (
    <div
      dir="rtl"
      className="va-surface-muted fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] right-4 z-[var(--va-z-toast)] flex items-center gap-1 rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-1.5 text-sm text-[var(--va-text)] shadow-[var(--va-elev-2)] md:bottom-4 lg:right-[296px]"
      role="group"
      aria-label="تراجع وإعادة"
    >
      <button
        type="button"
        disabled={!snapshot.canUndo}
        onClick={() => undoRedoManager.undo()}
        title="تراجع"
        aria-label="تراجع"
        className="inline-flex items-center gap-1.5 rounded-[var(--va-radius-md)] px-3 py-2 font-medium text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Undo2 className="h-4 w-4" aria-hidden="true" />
        تراجع
      </button>
      <span aria-hidden="true" className="h-5 w-px bg-[var(--va-border-soft)]" />
      <button
        type="button"
        disabled={!snapshot.canRedo}
        onClick={() => undoRedoManager.redo()}
        title="إعادة"
        aria-label="إعادة"
        className="inline-flex items-center gap-1.5 rounded-[var(--va-radius-md)] px-3 py-2 font-medium text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Redo2 className="h-4 w-4" aria-hidden="true" />
        إعادة
      </button>
    </div>
  );
}

export function StatusBar() {
  const backgroundOperation = useAppStore((state: any) => state.backgroundOperation);
  if (!backgroundOperation) return null;
  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="va-surface-muted fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] right-1/2 z-[var(--va-z-toast)] max-w-[92vw] translate-x-1/2 truncate rounded-full border border-[var(--va-border-soft)] bg-[var(--va-elevated)] px-4 py-2 text-sm text-[var(--va-text-2)] shadow-[var(--va-elev-2)] md:bottom-4"
    >
      {backgroundOperation.label || "عملية تعمل في الخلفية"}
    </div>
  );
}

export function ForceChangePasswordDialog() {
  const mustChangePassword = useAuthStore((state: any) => state.mustChangePassword);
  const forceChangePassword = useAuthStore((state: any) => state.forceChangePassword);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  if (!mustChangePassword) return null;

  const submit = async (event: any) => {
    event.preventDefault();
    const ok = await forceChangePassword?.(password);
    if (!ok) setError("تعذر تغيير كلمة المرور. استخدم كلمة مرور أقوى.");
  };

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[var(--va-z-modal)] flex items-center justify-center bg-black/55 p-4 text-start text-[var(--va-text)] backdrop-blur-sm">
      <form onSubmit={submit} className="va-surface-muted w-full max-w-md rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-6 shadow-[var(--va-elev-popover)]">
        <KeyRound className="h-9 w-9 va-accent-text" />
        <h2 className="mt-4 text-xl font-bold">تغيير كلمة المرور مطلوب</h2>
        <PasswordField
          value={password}
          onChange={(event: any) => setPassword(event.target.value)}
          className="mt-5"
          autoComplete="new-password"
          placeholder="كلمة المرور الجديدة"
        />
        {error && <p role="alert" aria-live="assertive" className="mt-3 text-sm text-[var(--va-status-danger)]">{error}</p>}
        <button type="submit" className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--va-radius-md)] border border-transparent bg-emerald-500 px-4 text-sm font-medium text-[var(--va-text-inverse)] transition-colors hover:bg-emerald-600 active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]">حفظ كلمة المرور</button>
      </form>
    </div>,
    document.body
  );
}

const FEATURE_TOUR_SLIDE_ICONS = [Compass, Archive, Command, Sparkles];

function createFeatureTourSlides() {
  return [
    {
      title: "مكوّنات الواجهة الأساسية",
      body: "تعرّف على أربعة مكوّنات تستخدمها يومياً.",
      detailItems: CORE_UI_TOUR_ITEMS.map((item: any) => ({ label: item.label, detail: item.detail })),
    },
    {
      title: "الأرشيف والبحث",
      body: "أضف مواد جديدة وصنّفها بالأنواع والوسوم، ثم ابحث فورياً في العناوين والنصوص والتفريغ الصوتي.",
    },
    {
      title: "اختصارات لوحة المفاتيح",
      body: "هذه الاختصارات تُسرّع عملك اليومي. اضغط ? في أي وقت لعرض القائمة الكاملة.",
      shortcuts: ONBOARDING_SHORTCUTS,
    },
    {
      title: "الذكاء الاصطناعي والتصدير",
      body: "تفريغ صوتي تلقائي، اقتراح وسوم، مونتاج مرئي متعدد المسارات، ومشاركة روابط محدودة الصلاحيات — كل ذلك من داخل الأرشيف.",
    },
  ];
}

export function V1ProductTour({ open, onComplete, onSkip }: any) {
  const [index, setIndex] = React.useState(0);
  const slides = React.useMemo(() => createFeatureTourSlides(), []);
  React.useEffect(() => {
    if (open) setIndex(0);
  }, [open]);
  if (!open) return null;
  const slide = slides[index] || slides[0];
  const last = index >= slides.length - 1;
  const SlideIcon = FEATURE_TOUR_SLIDE_ICONS[index] || Compass;
  return createPortal(
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-tour-title"
      className="fixed inset-0 z-[var(--va-z-modal)] flex items-end justify-center bg-black/55 p-4 text-start text-[var(--va-text)] backdrop-blur-sm sm:items-center"
    >
      <section className="w-full max-w-lg rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-6 shadow-[var(--va-elev-popover)]">
        {/* slide header */}
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--va-radius-md)] va-accent-bg-soft">
            <SlideIcon className="h-5 w-5 va-accent-text" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold va-accent-text">{index + 1} / {slides.length}</p>
            <h2 id="feature-tour-title" className="mt-1 text-xl font-bold">{slide.title}</h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-[var(--va-text-2)]">{slide.body}</p>

        {/* CORE_UI_TOUR_ITEMS list */}
        {slide.detailItems && (
          <ul className="mt-4 space-y-2">
            {slide.detailItems.map((item: any) => (
              <li
                key={item.label}
                className="flex items-start gap-3 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full va-accent-bg" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs leading-5 text-[var(--va-text-muted)]">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* keyboard shortcuts grid */}
        {slide.shortcuts && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {slide.shortcuts.map((s: any) => (
              <div
                key={s.label}
                className="flex items-center gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-2"
              >
                <div className="flex shrink-0 gap-1">
                  {s.keys.map((k: any) => (
                    <kbd
                      key={k}
                      className="rounded border border-[var(--va-border-strong)] bg-[var(--va-surface)] px-1.5 py-0.5 font-mono text-[11px]"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
                <span className="min-w-0 truncate text-xs text-[var(--va-text-2)]">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* dot progress + nav */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-transparent px-4 py-2 text-sm text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]"
          >
            تخطّى نهائياً
          </button>

          {/* slide dots */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="الشرائح">
            {slides.map((_: any, i: any) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`الشريحة ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 ${
                  i === index ? "w-5 va-accent-bg" : "w-2 bg-[var(--va-border-strong)] hover:bg-[var(--va-text-muted)]"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => (last ? onComplete?.() : setIndex((v: any) => v + 1))}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--va-radius-md)] border border-transparent bg-emerald-500 px-4 text-sm font-medium text-[var(--va-text-inverse)] transition-colors hover:bg-emerald-600 active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]"
          >
            {last ? "إنهاء الجولة" : "التالي"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
