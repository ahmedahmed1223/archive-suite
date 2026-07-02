"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppHeader from "@/components/AppHeader";
import { BRAND } from "@/lib/brand";
import { createArchiveApiClient, type ArchiveUser } from "@/lib/archive-api";

type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; user: ArchiveUser; expiresAt: string }
  | { status: "error"; message: string };

export default function LoginPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<LoginState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "loading" });

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const response = await api.login({ email, password });

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({ status: "success", user: response.user, expiresAt: response.expiresAt });
  }

  return (
    <main className="shell">
      <AppHeader subtitle="تسجيل الدخول" />

      <section className="content auth-layout" aria-label="تسجيل الدخول">
        <div className="panel auth-brand-panel">
          <img className="auth-brand-mark" src={BRAND.markPath} alt="" width={56} height={56} />
          <div className="auth-copy">
            <span className="badge">{BRAND.descriptor}</span>
            <h1>تسجيل الدخول إلى {BRAND.arabicName}</h1>
            <p>
              استخدم بيانات حسابك للدخول إلى لوحة التحكم. يتم إرسال بيانات الدخول
              عبر HTTPS وحفظ الجلسات بشكل آمن عبر HttpOnly cookies.
            </p>
          </div>
          <div className="hero-actions">
            <span className="badge">مصادقة آمنة</span>
            <span className="badge">Laravel API</span>
          </div>
        </div>

        <form className="panel auth-form" onSubmit={handleSubmit} method="post" aria-label="نموذج تسجيل الدخول">
          <div className="panel-section-header">
            <h2>بيانات الدخول</h2>
          </div>

          <div>
            <label htmlFor="email">
              البريد الإلكتروني
            </label>
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
            <label htmlFor="password">
              كلمة المرور
            </label>
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

          <button
            type="submit"
            className="button button-primary"
            disabled={state.status === "loading"}
          >
            {state.status === "loading" ? "جار التحقق..." : "تسجيل الدخول"}
          </button>

          {(state.status === "error" || state.status === "success") && (
            <div
              id="auth-error"
              className={`state-banner ${
                state.status === "error"
                  ? "state-banner-error"
                  : "state-banner-success"
              }`}
              role={state.status === "error" ? "alert" : "status"}
            >
              <strong>
                {state.status === "success"
                  ? "تم تسجيل الدخول بنجاح"
                  : "فشل تسجيل الدخول"}
              </strong>
              <span className="helper-text">
                {state.status === "success"
                  ? `مرحباً ${state.user.email ?? state.user.name ?? state.user.id}`
                  : state.message}
              </span>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
