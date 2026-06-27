"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
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
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Next.js auth migration</span>
        </div>
        <a className="badge" href="/">حالة الترحيل</a>
      </header>

      <section className="content auth-layout" aria-label="تسجيل الدخول">
        <div className="hero auth-copy">
          <span className="badge">Laravel session auth</span>
          <h1>تسجيل دخول Next.js عبر جلسات Laravel.</h1>
          <p>
            هذه الصفحة تختبر مسار `login` الجديد: access token قصير العمر في
            الذاكرة، وrefresh cookie باسم `va_refresh` يظل HttpOnly.
          </p>
        </div>

        <form className="panel auth-form" onSubmit={handleSubmit}>
          <label>
            البريد الإلكتروني
            <input name="email" type="email" autoComplete="email" required />
          </label>

          <label>
            كلمة المرور
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          <button type="submit" disabled={state.status === "loading"}>
            {state.status === "loading" ? "جار التحقق..." : "تسجيل الدخول"}
          </button>

          <p className="form-status" role="status">
            {state.status === "success"
              ? `تم تسجيل الدخول كـ ${state.user.email ?? state.user.name ?? state.user.id}`
              : state.status === "error"
                ? state.message
                : "جاهز للاتصال بـ /api/v1/auth/login."}
          </p>
        </form>
      </section>
    </main>
  );
}
