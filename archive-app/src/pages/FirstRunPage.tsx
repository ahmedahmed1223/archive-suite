import { useState } from "react";
import { Archive, User, Palette, CheckCircle2 } from "lucide-react";
import { useAppStore } from "../stores/index.js";
import { applyDaisyTheme, storeDaisyTheme } from "../features/theme/daisyThemes.js";

const STEPS = [
  { id: "account", icon: User,          label: "إنشاء حساب المشرف" },
  { id: "theme",   icon: Palette,       label: "اختيار مظهر النظام" },
  { id: "done",    icon: CheckCircle2,  label: "جاهز للبدء" },
];

export function FirstRunPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [theme, setTheme] = useState("business");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { navigateTo, showToast, setCurrentPage } = useAppStore((s: any) => ({
    navigateTo:     s.navigateTo,
    showToast:      s.showToast,
    setCurrentPage: s.setCurrentPage,
  }));

  async function handleCreateAdmin(e: any) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    if (form.password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          email:    form.email,
          password: form.password,
          role:     "admin",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "فشل إنشاء الحساب");
      }
      setStep(1);
    } catch (ex: any) {
      setError(ex.message);
    } finally {
      setLoading(false);
    }
  }

  function handleThemeDone() {
    applyDaisyTheme(theme);
    storeDaisyTheme(theme);
    setStep(2);
  }

  function handleFinish() {
    showToast?.({ type: "success", message: "مرحباً! تم إعداد النظام بنجاح." });
    // Prefer navigateTo; fall back to setCurrentPage
    if (typeof navigateTo === "function") {
      navigateTo("dashboard");
    } else {
      setCurrentPage?.("dashboard");
    }
  }

  const FIELDS = [
    { key: "username",        label: "اسم المستخدم",       type: "text",     placeholder: "admin" },
    { key: "email",           label: "البريد الإلكتروني",  type: "email",    placeholder: "admin@example.com" },
    { key: "password",        label: "كلمة المرور",        type: "password", placeholder: "8 أحرف على الأقل" },
    { key: "confirmPassword", label: "تأكيد كلمة المرور",  type: "password", placeholder: "" },
  ];

  const THEMES = [
    { id: "business", label: "تشغيلي",  color: "#1c1c1c" },
    { id: "corporate", label: "مؤسسي",  color: "#ffffff" },
    { id: "night", label: "ليلي",     color: "#0f172a" },
    { id: "emerald", label: "هادئ",     color: "#ffffff" },
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[var(--va-bg)] p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg">
            <Archive className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">مرحباً بك في Archive Suite</h1>
          <p className="text-sm text-[var(--va-text-muted)] text-center">
            سنساعدك على إعداد النظام في دقيقتين
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s: any, i: any) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  i < step
                    ? "bg-emerald-600 text-white"
                    : i === step
                      ? "bg-emerald-600/20 text-emerald-600 ring-2 ring-emerald-600"
                      : "bg-[var(--va-border)] text-[var(--va-text-muted)]",
                ].join(" ")}
              >
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${i < step ? "bg-emerald-600" : "bg-[var(--va-border)]"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 0: Create admin ─────────────────────────────────────── */}
        {step === 0 && (
          <form
            onSubmit={handleCreateAdmin}
            className="space-y-4 p-6 rounded-2xl border border-[var(--va-border)] bg-[var(--va-surface)]"
          >
            <h2 className="text-lg font-semibold">إنشاء حساب المشرف</h2>

            {error && (
              <p role="alert" className="text-sm text-red-500 bg-red-500/10 rounded-lg p-2">
                {error}
              </p>
            )}

            {FIELDS.map((f: any) => (
              <div key={f.key}>
                <label className="text-sm font-medium block mb-1">{f.label}</label>
                <input
                  type={f.type}
                  required
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={(e: any) => setForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--va-border)] bg-[var(--va-bg)] text-sm focus:outline-none focus:ring-2 ring-emerald-500"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {loading ? "جاري الإنشاء..." : "إنشاء الحساب والمتابعة ←"}
            </button>
          </form>
        )}

        {/* ── Step 1: Choose theme ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 p-6 rounded-2xl border border-[var(--va-border)] bg-[var(--va-surface)]">
            <h2 className="text-lg font-semibold">اختر مظهر النظام</h2>

            <div className="grid grid-cols-2 gap-3">
              {THEMES.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={[
                    "p-3 rounded-xl border-2 transition-colors text-sm font-medium",
                    theme === t.id
                      ? "border-emerald-600 bg-emerald-600/10"
                      : "border-[var(--va-border)] hover:border-emerald-600/50",
                  ].join(" ")}
                >
                  <div className="w-full h-8 rounded-lg mb-2" style={{ background: t.color }} />
                  {t.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleThemeDone}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              متابعة ←
            </button>
          </div>
        )}

        {/* ── Step 2: Done ─────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="text-center space-y-4 p-6 rounded-2xl border border-[var(--va-border)] bg-[var(--va-surface)]">
            <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />
            <h2 className="text-xl font-bold">النظام جاهز!</h2>
            <p className="text-sm text-[var(--va-text-muted)]">
              تم إعداد Archive Suite بنجاح. يمكنك الآن البدء بإضافة سجلاتك.
            </p>
            <button
              onClick={handleFinish}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              الانتقال إلى لوحة التحكم ←
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default FirstRunPage;
