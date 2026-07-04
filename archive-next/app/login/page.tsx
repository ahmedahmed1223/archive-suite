"use client";

import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { BRAND } from "@/lib/brand";
import { safeNextPath, useAuthSession } from "@/lib/auth-session";
import { useRouter, useSearchParams } from "next/navigation";

type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

function LoginFallback() {
  return (
    <AppShell subtitle="تسجيل الدخول" navLabel="الدخول" contentClassName="login-content">
      <section className="session-loading" aria-busy="true">
        <span className="status-refresh-icon is-spinning" aria-hidden="true" />
        <span>جار تجهيز بوابة الدخول...</span>
      </section>
    </AppShell>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuthSession();
  const [state, setState] = useState<LoginState>({ status: "idle" });
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
    <AppShell subtitle="تسجيل الدخول" navLabel="الدخول" contentClassName="login-content">
      <PageToolbar
        eyebrow={<span className="badge">{BRAND.descriptor}</span>}
        title={`تسجيل الدخول إلى ${BRAND.arabicName}`}
        description="استخدم بيانات حسابك للدخول إلى لوحة التحكم. يتم إرسال بيانات الدخول عبر Laravel API وحفظ الجلسات عبر HttpOnly cookies."
        meta={
          <>
            <span className="badge">مصادقة آمنة</span>
            <span className="badge">Laravel API</span>
          </>
        }
      />

      <section className="auth-layout" aria-label="تسجيل الدخول">
        <div className="panel auth-brand-panel">
          <img className="auth-brand-mark" src={BRAND.markPath} alt="" width={56} height={56} />
          <div className="auth-copy">
            <h2>{BRAND.lockupName}</h2>
            <p>
              دخول موحد لإدارة السجلات، الملفات، الوسائط، المشاركة، والمراقبة التشغيلية من واجهة واحدة.
            </p>
          </div>
          <div className="button-row">
            <span className="badge">جلسات محمية</span>
            <span className="badge">Next + Laravel</span>
            <a className="badge" href="/first-run">أول تشغيل</a>
          </div>
        </div>

        <form className="panel auth-form" onSubmit={handleSubmit} method="post" aria-label="نموذج تسجيل الدخول">
          <div className="panel-section-header">
            <h2>بيانات الدخول</h2>
          </div>

          <div>
            <label htmlFor="email">البريد الإلكتروني</label>
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

          <div>
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={state.status === "loading"}
              aria-describedby={state.status === "error" ? "auth-error" : undefined}
            />
          </div>

          <button type="submit" className="button button-primary" disabled={state.status === "loading"}>
            {state.status === "loading" ? "جار التحقق..." : "تسجيل الدخول"}
          </button>

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
            </div>
          )}
        </form>
      </section>
    </AppShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
