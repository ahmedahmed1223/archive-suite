"use client";

import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * V14-UX-REVIEW-3: the login page links here from "Forgot password?".
 * Passwords are seeded/generated locally (no email service), so this page
 * explains how an administrator resets a password via Control Center, and
 * how users change their own password. Copy lives in the dictionaries so
 * both locales stay in sync (V2-305 Arabic-literal guard).
 */
export default function PasswordRecoveryPage() {
  const { t } = useLocale();
  const copy = t.pages.passwordRecovery;

  return (
    <AppShell subtitle={copy.subtitle} navLabel={copy.navLabel} contentClassName="help-content">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
      />

      <article className="panel">
        <h2>{copy.adminTitle}</h2>
        <ol className="record-note-list">
          {copy.adminSteps.map((step: string) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="helper-text" dir="ltr">{copy.adminCommand}</p>
      </article>

      <article className="panel">
        <h2>{copy.selfTitle}</h2>
        <ol className="record-note-list">
          {copy.selfSteps.map((step: string) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </article>

      <article className="state-banner state-banner-info">
        <strong>{copy.securityTitle}</strong>
        <p>{copy.securityBody}</p>
      </article>

      <div className="button-row">
        <a className="button button-secondary" href="/login">{copy.backToLogin}</a>
        <a className="button button-secondary" href="/help">{copy.backToHelp}</a>
      </div>
    </AppShell>
  );
}
