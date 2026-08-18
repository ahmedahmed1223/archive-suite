"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { buildPresetPatch, PRESET_IDS, type PresetId } from "@/lib/experience-presets";
import type { UpdateExperienceProfileRequest } from "@/lib/experience-profile";
import type { WriteOutcome } from "@/lib/experience-profile-context";

type ApplyState = { status: "idle" } | { status: "applying" } | { status: "success" } | { status: "error"; message: string };

interface PresetsSectionProps {
  onUpdate: (values: UpdateExperienceProfileRequest) => Promise<WriteOutcome>;
}

export default function PresetsSection({ onUpdate }: Readonly<PresetsSectionProps>) {
  const { t } = useLocale();
  const copy = t.pages.settings.hub.presets;
  const [applyState, setApplyState] = useState<Partial<Record<PresetId, ApplyState>>>({});

  async function applyPreset(id: PresetId) {
    setApplyState((current) => ({ ...current, [id]: { status: "applying" } }));

    // buildPresetPatch() reads the preset definition once, here, and returns
    // plain literal values -- this call is the one-time copy. Nothing keeps
    // a reference to `id` after this point.
    const patch = buildPresetPatch(id);
    const outcome = await onUpdate(patch);

    if (!outcome.ok) {
      setApplyState((current) => ({ ...current, [id]: { status: "error", message: outcome.failure.message } }));
      return;
    }

    setApplyState((current) => ({ ...current, [id]: { status: "success" } }));
  }

  return (
    <section className="workspace-panel panel-compact settings-hub__section" aria-labelledby="settings-hub-presets-heading">
      <h3 id="settings-hub-presets-heading">{copy.heading}</h3>
      <p className="helper-text">{copy.description}</p>

      <ul className="settings-hub__preset-list">
        {PRESET_IDS.map((id) => {
          const preset = copy.items[id];
          const state = applyState[id] ?? { status: "idle" };

          return (
            <li key={id} className="settings-hub__preset-row">
              <div>
                <strong>{preset.name}</strong>
                <p className="helper-text mt-tight">{preset.description}</p>
              </div>
              <button
                type="button"
                className="button button-secondary button-small"
                disabled={state.status === "applying"}
                onClick={() => void applyPreset(id)}
              >
                {state.status === "applying" ? copy.applying : copy.apply}
              </button>
              {state.status === "success" && (
                <p className="helper-text status-success" role="status">
                  {copy.applySuccess}
                </p>
              )}
              {state.status === "error" && (
                <p className="helper-text status-error" role="alert">
                  {state.message || copy.applyError}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
