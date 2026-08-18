"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ExperienceSettings, UpdateExperienceProfileRequest } from "@/lib/experience-profile";
import type { WriteOutcome } from "@/lib/experience-profile-context";
import type { components } from "@/lib/generated/archive-api";

type NotificationsValue = components["schemas"]["NotificationsExperienceSettings"];
type OptionalEvent = NonNullable<NotificationsValue["optional"]>[number];

const OPTIONAL_EVENTS: readonly OptionalEvent[] = [
  "reviewAssigned",
  "commentMentioned",
  "taskAssigned",
  "rightsExpiring",
  "mediaJobCompleted",
  "taskDueSoon"
];

type FieldState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

interface NotificationsSectionProps {
  experience: ExperienceSettings;
  onUpdate: (values: UpdateExperienceProfileRequest) => Promise<WriteOutcome>;
}

export default function NotificationsSection({ experience, onUpdate }: Readonly<NotificationsSectionProps>) {
  const { t } = useLocale();
  const copy = t.pages.settings.hub.notifications;
  const [fieldState, setFieldState] = useState<FieldState>({ status: "idle" });

  const notifications = (experience.notifications.value ?? { dailyDigest: false, optional: [] }) as NotificationsValue;

  async function commit(patch: UpdateExperienceProfileRequest) {
    setFieldState({ status: "saving" });

    const outcome = await onUpdate(patch);

    if (!outcome.ok) {
      setFieldState({ status: "error", message: outcome.failure.message });
      return;
    }

    setFieldState({ status: "idle" });
  }

  function toggleOptional(event: OptionalEvent, checked: boolean) {
    const current = new Set(notifications.optional ?? []);
    if (checked) current.add(event);
    else current.delete(event);
    void commit({ notifications: { ...notifications, optional: Array.from(current) } });
  }

  return (
    <section className="workspace-panel panel-compact settings-hub__section" aria-labelledby="settings-hub-notifications-heading">
      <h3 id="settings-hub-notifications-heading">{copy.heading}</h3>
      <p className="helper-text">{copy.description}</p>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={Boolean(notifications.dailyDigest)}
          disabled={!experience.notifications.editable}
          onChange={(event) => void commit({ notifications: { ...notifications, dailyDigest: event.target.checked } })}
        />
        {copy.dailyDigestLabel}
      </label>

      <fieldset className="stack">
        <legend className="field-note">{copy.optionalHeading}</legend>
        {OPTIONAL_EVENTS.map((event) => (
          <label className="checkbox-label" key={event}>
            <input
              type="checkbox"
              checked={(notifications.optional ?? []).includes(event)}
              disabled={!experience.notifications.editable}
              onChange={(changeEvent) => toggleOptional(event, changeEvent.target.checked)}
            />
            {copy.events[event]}
          </label>
        ))}
      </fieldset>

      {fieldState.status === "error" && (
        <p className="helper-text status-error" role="alert">
          {fieldState.message}
        </p>
      )}
    </section>
  );
}
