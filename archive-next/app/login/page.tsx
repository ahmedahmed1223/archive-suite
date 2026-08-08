"use client";

import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { BRAND } from "@/lib/brand";
import { safeNextPath, useAuthSession } from "@/lib/auth-session";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useRouter, useSearchParams } from "next/navigation";
import "./login.css";

type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

function LoginFallback() {
  const { t } = useLocale();
  return (
    <main className="shell login-shell">
      <PublicHeader subtitle={t.auth.login.title} />
      <section className="content login-content" aria-label={t.auth.login.loading}>
        <div className="session-loading" aria-busy="true">
          <span className="status-refresh-icon is-spinning" aria-hidden="true" />
          <span>{t.auth.login.loading}</span>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

function LoginPageContent() {
  const { locale, t } = useLocale();
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
    const rememberMe = data.get("rememberMe") === "on";
    const response = await auth.login({ email, password, rememberMe });

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({ status: "success" });
    router.replace(nextPath);
  }

  return (
    <main className="shell login-shell">
      <PublicHeader subtitle={t.auth.login.title} />

      <section className="content login-content" aria-label={t.auth.login.title}>
        <div className="login-portal" aria-label={t.auth.login.portal}>
          <section className="login-hero" aria-labelledby="login-title">
            <div className="login-hero__mark">
              <img src={BRAND.markPath} alt="" width={64} height={64} />
            </div>
            <span className="badge">{locale === "en" ? "Archive and media management" : BRAND.descriptor}</span>
            <div className="login-hero__copy">
              <h1 id="login-title">{t.auth.login.heading}</h1>
              <p>{t.auth.login.description}</p>
            </div>
            <div className="login-trust-grid" aria-label={t.auth.login.portal}>
              {t.auth.login.highlights.map((item) => (
                <span key={item}>
                  <ShieldCheck size={16} />
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="login-card" aria-label={t.auth.login.form}>
            <form className="auth-form login-card__form" onSubmit={handleSubmit} method="post" aria-label={t.auth.login.form}>
              <div className="login-card__header">
                <span className="login-card__icon" aria-hidden="true">
                  <KeyRound size={20} />
                </span>
                <div>
                  <h2>{t.auth.login.credentials}</h2>
                  <p>{t.auth.login.credentialsDescription}</p>
                </div>
              </div>

              <label htmlFor="email">{t.auth.login.email}</label>
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

              <label htmlFor="password">{t.auth.login.password}</label>
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
                  aria-label={showPassword ? t.auth.login.hidePassword : t.auth.login.showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <label className="login-remember">
                <input name="rememberMe" type="checkbox" disabled={state.status === "loading"} />
                <span>
                  <strong>{t.auth.login.remember}</strong>
                  <small>{t.auth.login.rememberHint}</small>
                </span>
              </label>

              <div className="login-card__actions">
                <button type="submit" className="button button-primary" disabled={state.status === "loading"}>
                  {state.status === "loading" ? t.auth.login.submitting : t.auth.login.submit}
                </button>
                <a className="badge" href="/first-run">{t.auth.login.gettingStarted}</a>
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
                {t.auth.login.secureSession}
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
