"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ExperienceSettings, UpdateExperienceProfileRequest } from "@/lib/experience-profile";
import type { WriteOutcome } from "@/lib/experience-profile-context";

type FieldState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

interface MyExperienceSectionProps {
  experience: ExperienceSettings;
  onUpdate: (values: UpdateExperienceProfileRequest) => Promise<WriteOutcome>;
}

export default function MyExperienceSection({ experience, onUpdate }: Readonly<MyExperienceSectionProps>) {
  const { t } = useLocale();
  const copy = t.pages.settings.hub.myExperience;
  const [fieldState, setFieldState] = useState<Record<string, FieldState>>({});
  const [timeZoneDraft, setTimeZoneDraft] = useState(experience.timeZone.value as string);
  const [homePageDraft, setHomePageDraft] = useState(experience.homePage.value as string);

  useEffect(() => setTimeZoneDraft(experience.timeZone.value as string), [experience.timeZone.value]);
  useEffect(() => setHomePageDraft(experience.homePage.value as string), [experience.homePage.value]);

  async function commit(field: keyof UpdateExperienceProfileRequest, patch: UpdateExperienceProfileRequest) {
    setFieldState((current) => ({ ...current, [field]: { status: "saving" } }));

    const outcome = await onUpdate(patch);

    if (!outcome.ok) {
      setFieldState((current) => ({ ...current, [field]: { status: "error", message: outcome.failure.message } }));
      return;
    }

    setFieldState((current) => ({ ...current, [field]: { status: "idle" } }));
  }

  function fieldError(field: string) {
    const state = fieldState[field];
    if (state?.status !== "error") return null;
    return (
      <p className="helper-text status-error" role="alert">
        {state.message}
      </p>
    );
  }

  const navigationValue = experience.navigation.value as { order?: string[]; hiddenModules?: string[] } | undefined;

  return (
    <section className="workspace-panel panel-compact settings-hub__section" aria-labelledby="settings-hub-experience-heading">
      <h3 id="settings-hub-experience-heading">{copy.heading}</h3>
      <p className="helper-text">{copy.description}</p>

      <div className="settings-hub__field-grid">
        <label>
          <span className="field-note">{copy.fields.locale.label}</span>
          <select
            className="search-input"
            value={experience.locale.value as string}
            disabled={!experience.locale.editable}
            onChange={(event) => void commit("locale", { locale: event.target.value as "ar" | "en" })}
          >
            <option value="ar">{copy.fields.locale.options.ar}</option>
            <option value="en">{copy.fields.locale.options.en}</option>
          </select>
          {fieldError("locale")}
        </label>

        <label>
          <span className="field-note">{copy.fields.timeZone.label}</span>
          <input
            className="search-input"
            dir="ltr"
            value={timeZoneDraft}
            disabled={!experience.timeZone.editable}
            onChange={(event) => setTimeZoneDraft(event.target.value)}
            onBlur={() => {
              if (timeZoneDraft !== experience.timeZone.value) void commit("timeZone", { timeZone: timeZoneDraft });
            }}
          />
          <span className="helper-text">{copy.fields.timeZone.hint}</span>
          {fieldError("timeZone")}
        </label>

        <label>
          <span className="field-note">{copy.fields.dateFormat.label}</span>
          <select
            className="search-input"
            value={experience.dateFormat.value as string}
            disabled={!experience.dateFormat.editable}
            onChange={(event) =>
              void commit("dateFormat", { dateFormat: event.target.value as "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" })
            }
          >
            <option value="DD/MM/YYYY">{copy.fields.dateFormat.options.dayFirst}</option>
            <option value="MM/DD/YYYY">{copy.fields.dateFormat.options.monthFirst}</option>
            <option value="YYYY-MM-DD">{copy.fields.dateFormat.options.yearFirst}</option>
          </select>
          {fieldError("dateFormat")}
        </label>

        <label>
          <span className="field-note">{copy.fields.timeFormat.label}</span>
          <select
            className="search-input"
            value={experience.timeFormat.value as string}
            disabled={!experience.timeFormat.editable}
            onChange={(event) => void commit("timeFormat", { timeFormat: event.target.value as "24h" | "12h" })}
          >
            <option value="24h">{copy.fields.timeFormat.options.h24}</option>
            <option value="12h">{copy.fields.timeFormat.options.h12}</option>
          </select>
          {fieldError("timeFormat")}
        </label>

        <label>
          <span className="field-note">{copy.fields.theme.label}</span>
          <select
            className="search-input"
            value={experience.theme.value as string}
            disabled={!experience.theme.editable}
            onChange={(event) =>
              void commit("theme", {
                theme: event.target.value as "cinematic-dark" | "luxury-dark" | "ocean-dark" | "neutral-light" | "high-contrast"
              })
            }
          >
            <option value="cinematic-dark">{copy.fields.theme.options.cinematicDark}</option>
            <option value="luxury-dark">{copy.fields.theme.options.luxuryDark}</option>
            <option value="ocean-dark">{copy.fields.theme.options.oceanDark}</option>
            <option value="neutral-light">{copy.fields.theme.options.neutralLight}</option>
            <option value="high-contrast">{copy.fields.theme.options.highContrast}</option>
          </select>
          {fieldError("theme")}
        </label>

        <label>
          <span className="field-note">{copy.fields.density.label}</span>
          <select
            className="search-input"
            value={experience.density.value as string}
            disabled={!experience.density.editable}
            onChange={(event) => void commit("density", { density: event.target.value as "comfortable" | "compact" })}
          >
            <option value="comfortable">{copy.fields.density.options.comfortable}</option>
            <option value="compact">{copy.fields.density.options.compact}</option>
          </select>
          {fieldError("density")}
        </label>

        <label>
          <span className="field-note">{copy.fields.textScale.label}</span>
          <select
            className="search-input"
            value={experience.textScale.value as string}
            disabled={!experience.textScale.editable}
            onChange={(event) => void commit("textScale", { textScale: event.target.value as "small" | "medium" | "large" })}
          >
            <option value="small">{copy.fields.textScale.options.small}</option>
            <option value="medium">{copy.fields.textScale.options.medium}</option>
            <option value="large">{copy.fields.textScale.options.large}</option>
          </select>
          {fieldError("textScale")}
        </label>

        <label>
          <span className="field-note">{copy.fields.homePage.label}</span>
          <input
            className="search-input"
            dir="ltr"
            value={homePageDraft}
            disabled={!experience.homePage.editable}
            onChange={(event) => setHomePageDraft(event.target.value)}
            onBlur={() => {
              if (homePageDraft !== experience.homePage.value) void commit("homePage", { homePage: homePageDraft });
            }}
          />
          <span className="helper-text">{copy.fields.homePage.hint}</span>
          {fieldError("homePage")}
        </label>
      </div>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={experience.reducedMotion.value as boolean}
          disabled={!experience.reducedMotion.editable}
          onChange={(event) => void commit("reducedMotion", { reducedMotion: event.target.checked })}
        />
        {copy.fields.reducedMotion.label}
      </label>
      {fieldError("reducedMotion")}

      <div className="section-divider">
        <strong>{copy.fields.navigation.label}</strong>
        <p className="helper-text mt-tight">
          {copy.fields.navigation.hiddenModulesTemplate.replace("{count}", String(navigationValue?.hiddenModules?.length ?? 0))}
          {" — "}
          {navigationValue?.order && navigationValue.order.length > 0 ? copy.fields.navigation.customOrderYes : copy.fields.navigation.customOrderNo}
        </p>
      </div>
    </section>
  );
}
