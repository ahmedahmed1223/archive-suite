"use client";

import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { BRAND } from "@/lib/brand";
import { safeNextPath, useAuthSession } from "@/lib/auth-session";
import { useRouter, useSearchParams } from "next/navigation";
import "./login.css";

type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

const loginHighlights = [
  "جلسات آمنة",
  "اتصال مشفَّر",
  "حماية موثوقة"
] as const;

function LoginFallback() {
  return (
    <main className="shell login-shell">
      <PublicHeader subtitle="تسجيل الدخول" />
      <section className="content login-content" aria-label="تجهيز تسجيل الدخول">
        <div className="session-loading" aria-busy="true">
          <span className="status-refresh-icon is-spinning" aria-hidden="true" />
          <span>جار تجهيز بوابة الدخول...</span>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuthSession();
  const [state, setState] = useState<LoginState>({ status: "idle" });
  const [showPassword, setShowPassword] = useState(false);
  const nextPath = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace(nextPath);
    }
  }, [auth.status, nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "loading" });

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const response = await auth.login({ email, password });

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({ status: "success" });
    router.replace(nextPath);
  }

  return (
    <main className="shell login-shell">
      <PublicHeader subtitle="تسجيل الدخول" />

      <section className="content login-content" aria-label="تسجيل الدخول">
        <div className="login-portal" aria-label="بوابة تسجيل الدخول">
          <section className="login-hero" aria-labelledby="login-title">
            <div className="login-hero__mark">
              <img src={BRAND.markPath} alt="" width={64} height={64} />
            </div>
            <span className="badge">{BRAND.descriptor}</span>
            <div className="login-hero__copy">
              <h1 id="login-title">تسجيل الدخول إلى {BRAND.arabicName}</h1>
              <p>
                بوابة آمنة ومختصرة للوصول إلى مساحة إدارة السجلات والوسائط. بعد الدخول فقط تظهر أدوات التشغيل
                والتنقل الداخلي.
              </p>
            </div>
            <div className="login-trust-grid" aria-label="خصائص الدخول">
              {loginHighlights.map((item) => (
                <span key={item}>
                  <ShieldCheck size={16} />
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="login-card" aria-label="نموذج تسجيل الدخول">
            <form className="auth-form login-card__form" onSubmit={handleSubmit} method="post" aria-label="نموذج تسجيل الدخول">
              <div className="login-card__header">
                <span className="login-card__icon" aria-hidden="true">
                  <KeyRound size={20} />
                </span>
                <div>
                  <h2>بيانات الدخول</h2>
                  <p>استخدم حسابك للمتابعة إلى لوحة التحكم.</p>
                </div>
              </div>

              <label htmlFor="email">البريد الإلكتروني</label>
              <div className="login-field">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                  disabled={state.status === "loading"}
                  aria-describedby={state.status === "error" ? "auth-error" : undefined}
                />
              </div>

              <label htmlFor="password">كلمة المرور</label>
              <div className="login-field">
                <KeyRound size={18} aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={state.status === "loading"}
                  aria-describedby={state.status === "error" ? "auth-error" : undefined}
                />
                <button
                  type="button"
                  className="login-field__toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={state.status === "loading"}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="login-card__actions">
                <button type="submit" className="button button-primary" disabled={state.status === "loading"}>
                  {state.status === "loading" ? "جار التحقق..." : "تسجيل الدخول"}
                </button>
                <a className="badge" href="/first-run">أول تشغيل</a>
              </div>

              {(state.status === "error" || state.status === "success") && (
                <div
                  id="auth-error"
                  className={`state-banner ${state.status === "error" ? "state-banner-error" : "state-banner-success"}`}
                  role={state.status === "error" ? "alert" : "status"}
                >
                  <strong>{state.status === "success" ? "تم تسجيل الدخول بنجاح" : "فشل تسجيل الدخول"}</strong>
                  <span className="helper-text">
                    {state.status === "success"
                      ? "سيتم تحويلك الآن إلى مساحة العمل."
                      : state.message}
                  </span>
                  {state.status === "error" ? (
                    <span className="button-row">
                      <a className="button button-secondary button-sm" href="/status">افحص حالة الخادم</a>
                      <a className="button button-secondary button-sm" href="/first-run">ارجع إلى رحلة الإعداد</a>
                    </span>
                  ) : null}
                </div>
              )}
            </form>

            <div className="login-card__note">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                يتم حفظ الجلسة عبر cookie آمن، ولا تُعرض مساحة العمل قبل المصادقة.
              </span>
            </div>
          </section>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
