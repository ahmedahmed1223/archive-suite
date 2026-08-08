"use client";

import { useState } from "react";

import { useAuthSession } from "@/lib/auth-session";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/types";

type SaveStatus = "idle" | "pending" | "success" | "error";

export default function LanguageSettings() {
  const { status: authStatus, updateAccountLocale } = useAuthSession();
  const { locale, setLocale, t } = useLocale();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  async function changeLanguage(nextLocale: AppLocale) {
    if (nextLocale === locale) return;

    const previousLocale = locale;
    setSaveStatus("pending");
    setLocale(nextLocale);

    const result = await updateAccountLocale(nextLocale);
    if (!result.ok) {
      setLocale(previousLocale);
      setSaveStatus("error");
      return;
    }

    setSaveStatus("success");
  }

  return (
    <article className="workspace-panel" aria-labelledby="language-settings-title">
      <div className="workspace-panel__header">
        <div>
          <h2 id="language-settings-title">{t.settings.language.title}</h2>
          <p>{t.settings.language.description}</p>
        </div>
      </div>
      <label className="stack" style={{ maxWidth: "24rem" }}>
        <span className="field-note">{t.settings.language.label}</span>
        <select
          className="search-input"
          aria-label={t.settings.language.label}
          value={locale}
          disabled={authStatus !== "authenticated" || saveStatus === "pending"}
          onChange={(event) => void changeLanguage(event.target.value as AppLocale)}
        >
          <option value="ar">{t.shared.languages.ar}</option>
          <option value="en">{t.shared.languages.en}</option>
        </select>
      </label>
      {saveStatus !== "idle" && (
        <p
          className={`helper-text mt-tight${saveStatus === "error" ? " status-error" : ""}`}
          role={saveStatus === "error" ? "alert" : "status"}
        >
          {saveStatus === "pending" && t.settings.language.saving}
          {saveStatus === "success" && t.settings.language.success}
          {saveStatus === "error" && t.settings.language.error}
        </p>
      )}
    </article>
  );
}
