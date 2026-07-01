"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createArchiveApiClient, type ArchiveUser } from "@/lib/archive-api";

type LoginState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; user: ArchiveUser; expiresAt: string }
  | { status: "error"; message: string };

const navLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/archive", label: "السجلات" },
  { href: "/files", label: "الملفات" },
  { href: "/reports", label: "التقارير" },
  { href: "/help", label: "المساعدة" },
  { href: "/media/jobs", label: "Media jobs" }
] as const;

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
        <nav className="route-links" aria-label="مسارات سريعة">
          {navLinks.map((link) => (
            <a key={link.href} className="badge" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="content auth-layout" aria-label="تسجيل الدخول">
        <div className="hero auth-copy">
          <h1>تسجيل دخول Next.js عبر جلسات Laravel.</h1>
          <p>
            هذه الصفحة تختبر مسار `login` الجديد: access token قصير العمر في
            الذاكرة، وrefresh cookie باسم `va_refresh` يظل HttpOnly.
          </p>
          <div className="hero-actions">
            <span className="badge">Laravel session auth</span>
            <span className="badge">/api/v1/auth/login</span>
          </div>
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

          <button type="submit" className="button button-primary" disabled={state.status === "loading"}>
            {state.status === "loading" ? "جار التحقق..." : "تسجيل الدخول"}
          </button>

          <div
            className={`state-banner ${
              state.status === "error"
                ? "state-banner-error"
                : state.status === "success"
                  ? "state-banner-success"
                  : ""
            }`}
            role="status"
          >
            <strong>
              {state.status === "success"
                ? "تم تسجيل الدخول"
                : state.status === "error"
                  ? "تعذر تسجيل الدخول"
                  : "جاهز"}
            </strong>
            <span className="helper-text">
              {state.status === "success"
                ? `تم تسجيل الدخول كـ ${state.user.email ?? state.user.name ?? state.user.id} · ينتهي ${state.expiresAt}`
                : state.status === "error"
                  ? state.message
                  : "جاهز للاتصال بـ /api/v1/auth/login."}
            </span>
          </div>
        </form>
      </section>
    </main>
  );
}
