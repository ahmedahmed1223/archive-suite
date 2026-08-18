"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { StatusBadge, type StatusBadgeTone } from "./StatusBadgeControl";
import { CAPABILITY_KEYS, type Capabilities, type CapabilityKey, type CapabilityStatus, type UpdateCapabilitiesRequest } from "@/lib/experience-profile";
import type { WriteOutcome } from "@/lib/experience-profile-context";

const STATUS_TONE: Record<CapabilityStatus, StatusBadgeTone> = {
  enabled: "success",
  disabled: "neutral",
  needs_configuration: "warning",
  unavailable: "danger"
};

type RowState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

interface AdministrationSectionProps {
  capabilities: Capabilities;
  onUpdate: (values: Omit<UpdateCapabilitiesRequest, "expectedVersions">) => Promise<WriteOutcome>;
}

export default function AdministrationSection({ capabilities, onUpdate }: Readonly<AdministrationSectionProps>) {
  const { t } = useLocale();
  const copy = t.pages.settings.hub.administration;
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  async function handleToggle(key: CapabilityKey, nextValue: boolean) {
    setRowState((current) => ({ ...current, [key]: { status: "saving" } }));

    const outcome = await onUpdate({ [key]: nextValue });

    if (!outcome.ok) {
      setRowState((current) => ({ ...current, [key]: { status: "error", message: outcome.failure.message } }));
      return;
    }

    setRowState((current) => ({ ...current, [key]: { status: "idle" } }));
  }

  return (
    <section className="workspace-panel panel-compact settings-hub__section" aria-labelledby="settings-hub-admin-heading">
      <h3 id="settings-hub-admin-heading">{copy.heading}</h3>
      <p className="helper-text">{copy.description}</p>

      <ul className="settings-hub__capability-list">
        {CAPABILITY_KEYS.map((key) => {
          const capability = capabilities[key];
          const fieldCopy = copy.capabilities[key];
          const currentRowState = rowState[key] ?? { status: "idle" };
          const inputId = `capability-${key}`;
          const reasonId = `${inputId}-reason`;
          const showLockNote = Boolean(capability.reason) || !capability.editable;

          return (
            <li key={key} className="settings-hub__capability-row">
              <div className="settings-hub__capability-row-header">
                <label className="checkbox-label">
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={capability.value}
                    disabled={!capability.editable || currentRowState.status === "saving"}
                    aria-describedby={showLockNote ? reasonId : undefined}
                    onChange={(event) => void handleToggle(key, event.target.checked)}
                  />
                  {fieldCopy.label}
                </label>
                <StatusBadge tone={STATUS_TONE[capability.status]}>{copy.statusLabels[capability.status]}</StatusBadge>
              </div>

              <p className="helper-text mt-tight">{fieldCopy.description}</p>

              {showLockNote && (
                <p id={reasonId} className="helper-text settings-hub__lock-reason">
                  <span>{capability.reason ?? copy.notEditableNote}</span>
                  <span className="badge">{copy.sourceLabels[capability.source]}</span>
                </p>
              )}

              {currentRowState.status === "error" && (
                <p className="helper-text status-error" role="alert">
                  {currentRowState.message}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
