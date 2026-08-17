"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { getLocalizedNavigation, isMandatoryNavHref, isNavHrefCapabilityLocked, reorderNavigationSections } from "@/lib/navigation";
import type { Capabilities, ExperienceSettings, UpdateExperienceProfileRequest } from "@/lib/experience-profile";
import type { WriteOutcome } from "@/lib/experience-profile-context";
import type { components } from "@/lib/generated/archive-api";

type NavigationExperienceSettings = components["schemas"]["NavigationExperienceSettings"];
type FieldState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

interface NavigationCustomizationSectionProps {
  experience: ExperienceSettings;
  capabilities: Capabilities;
  onUpdate: (values: UpdateExperienceProfileRequest) => Promise<WriteOutcome>;
}

export default function NavigationCustomizationSection({
  experience,
  capabilities,
  onUpdate
}: Readonly<NavigationCustomizationSectionProps>) {
  const { locale, t } = useLocale();
  const copy = t.pages.settings.hub.navigationCustomization;
  const { sections, items } = getLocalizedNavigation(locale);
  const navigationValue = experience.navigation.value as NavigationExperienceSettings | undefined;
  const [fieldState, setFieldState] = useState<FieldState>({ status: "idle" });

  const orderedSections = reorderNavigationSections(sections, navigationValue?.order);
  const sectionOrder = orderedSections.map(([key]) => key);
  const hiddenModules = new Set(navigationValue?.hiddenModules ?? []);
  const isEditable = experience.navigation.editable;
  const isSaving = fieldState.status === "saving";

  async function commit(next: NavigationExperienceSettings) {
    setFieldState({ status: "saving" });
    const outcome = await onUpdate({ navigation: next });

    if (!outcome.ok) {
      setFieldState({ status: "error", message: outcome.failure.message });
      return;
    }

    setFieldState({ status: "idle" });
  }

  function moveSection(section: (typeof sectionOrder)[number], direction: -1 | 1) {
    const index = sectionOrder.indexOf(section);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= sectionOrder.length) return;

    const nextOrder = [...sectionOrder];
    [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
    void commit({ order: nextOrder, hiddenModules: [...hiddenModules] });
  }

  function toggleHref(href: string, hide: boolean) {
    // Mandatory and capability-locked hrefs never reach this handler (their
    // checkboxes are disabled below), but guard here too so a stray call
    // can never write a mandatory href into hiddenModules.
    if (isMandatoryNavHref(href) || isNavHrefCapabilityLocked(href, capabilities)) return;

    const next = new Set(hiddenModules);
    if (hide) next.add(href);
    else next.delete(href);
    void commit({ order: sectionOrder, hiddenModules: [...next] });
  }

  return (
    <section className="workspace-panel panel-compact settings-hub__section" aria-labelledby="settings-hub-navigation-heading">
      <h3 id="settings-hub-navigation-heading">{copy.heading}</h3>
      <p className="helper-text">{copy.description}</p>

      {fieldState.status === "error" && (
        <p className="helper-text status-error" role="alert">
          {fieldState.message || copy.saveError}
        </p>
      )}

      <div className="section-divider">
        <strong>{copy.orderHeading}</strong>
        <ol className="settings-hub__nav-order-list mt-tight">
          {orderedSections.map(([section, label], index) => (
            <li key={section} className="settings-hub__nav-order-row">
              <span>{label}</span>
              <span className="settings-hub__nav-order-controls">
                <button
                  type="button"
                  className="button button-ghost button-small"
                  disabled={index === 0 || !isEditable || isSaving}
                  aria-label={`${copy.moveUp}: ${label}`}
                  onClick={() => moveSection(section, -1)}
                >
                  {"↑"}
                </button>
                <button
                  type="button"
                  className="button button-ghost button-small"
                  disabled={index === orderedSections.length - 1 || !isEditable || isSaving}
                  aria-label={`${copy.moveDown}: ${label}`}
                  onClick={() => moveSection(section, 1)}
                >
                  {"↓"}
                </button>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="section-divider">
        <strong>{copy.visibilityHeading}</strong>
        {orderedSections.map(([section, sectionLabel]) => (
          <fieldset className="stack mt-tight" key={section}>
            <legend className="field-note">{sectionLabel}</legend>
            {items
              .filter((item) => item.section === section)
              .map((item) => {
                const mandatory = isMandatoryNavHref(item.href);
                const locked = isNavHrefCapabilityLocked(item.href, capabilities);
                const checked = mandatory ? true : locked ? false : !hiddenModules.has(item.href);
                const reasonId = mandatory || locked ? `nav-visibility-${item.href.replace(/\W+/g, "-")}-reason` : undefined;

                return (
                  <div key={item.href}>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={mandatory || locked || !isEditable || isSaving}
                        aria-describedby={reasonId}
                        onChange={(event) => toggleHref(item.href, !event.target.checked)}
                      />
                      {item.label}
                    </label>
                    {reasonId && (
                      <p id={reasonId} className="helper-text mt-tight">
                        {mandatory ? copy.lockedMandatory : copy.lockedByCapability}
                      </p>
                    )}
                  </div>
                );
              })}
          </fieldset>
        ))}
      </div>
    </section>
  );
}
