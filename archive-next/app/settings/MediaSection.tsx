"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { StatusBadge, type StatusBadgeTone } from "./StatusBadgeControl";
import type { Capabilities, CapabilityStatus, ExperienceSettings, UpdateExperienceProfileRequest } from "@/lib/experience-profile";
import type { WriteOutcome } from "@/lib/experience-profile-context";
import type { components } from "@/lib/generated/archive-api";

type StudioLayoutValue = components["schemas"]["StudioLayoutExperienceSettings"];
type PanelKey = NonNullable<StudioLayoutValue["panels"]>[number];
type ArchiveViewValue = NonNullable<components["schemas"]["ViewsExperienceSettings"]["archive"]>;

const STATUS_TONE: Record<CapabilityStatus, StatusBadgeTone> = {
  enabled: "success",
  disabled: "neutral",
  needs_configuration: "warning",
  unavailable: "danger"
};

const MEDIA_CAPABILITY_KEYS = ["mediaProcessing", "ocr", "broadcastMetadata"] as const;

type FieldState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

interface MediaSectionProps {
  experience: ExperienceSettings;
  capabilities: Capabilities;
  onUpdate: (values: UpdateExperienceProfileRequest) => Promise<WriteOutcome>;
}

export default function MediaSection({ experience, capabilities, onUpdate }: Readonly<MediaSectionProps>) {
  const { t } = useLocale();
  const copy = t.pages.settings.hub.media;
  const adminCopy = t.pages.settings.hub.administration;
  const [fieldState, setFieldState] = useState<Record<string, FieldState>>({});

  const studioLayout = (experience.studioLayout.value ?? {}) as StudioLayoutValue;
  const shortcuts = (experience.shortcuts.value ?? {}) as Record<string, string>;
  const archiveView = ((experience.views.value as { archive?: ArchiveViewValue } | undefined)?.archive ?? {}) as ArchiveViewValue;

  const [timelineHeightDraft, setTimelineHeightDraft] = useState(String(studioLayout.timelineHeight ?? 240));
  const [pageSizeDraft, setPageSizeDraft] = useState(String(archiveView.pageSize ?? 25));
  const [shortcutDrafts, setShortcutDrafts] = useState(shortcuts);

  useEffect(() => setTimelineHeightDraft(String(studioLayout.timelineHeight ?? 240)), [studioLayout.timelineHeight]);
  useEffect(() => setPageSizeDraft(String(archiveView.pageSize ?? 25)), [archiveView.pageSize]);
  useEffect(() => setShortcutDrafts(shortcuts), [experience.shortcuts.value]); // eslint-disable-line react-hooks/exhaustive-deps

  async function commit(field: string, patch: UpdateExperienceProfileRequest) {
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

  function togglePanel(panel: PanelKey, checked: boolean) {
    const current = new Set(studioLayout.panels ?? []);
    if (checked) current.add(panel);
    else current.delete(panel);
    void commit("studioLayout.panels", { studioLayout: { ...studioLayout, panels: Array.from(current) } });
  }

  return (
    <section className="workspace-panel panel-compact settings-hub__section" aria-labelledby="settings-hub-media-heading">
      <h3 id="settings-hub-media-heading">{copy.heading}</h3>
      <p className="helper-text">{copy.description}</p>

      <div className="section-divider">
        <strong>{copy.capabilitiesHeading}</strong>
        <div className="kv-grid mt-tight">
          {MEDIA_CAPABILITY_KEYS.map((key) => {
            const capability = capabilities[key];
            return (
              <div className="kv-item" key={key}>
                <strong>{adminCopy.capabilities[key].label}</strong>
                <StatusBadge tone={STATUS_TONE[capability.status]}>{adminCopy.statusLabels[capability.status]}</StatusBadge>
                {capability.reason ? <span className="helper-text">{capability.reason}</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-divider">
        <strong>{copy.studioLayout.heading}</strong>
        <div className="settings-hub__field-grid mt-tight">
          <label>
            <span className="field-note">{copy.studioLayout.comments.label}</span>
            <select
              className="search-input"
              value={studioLayout.comments ?? "right"}
              disabled={!experience.studioLayout.editable}
              onChange={(event) =>
                void commit("studioLayout.comments", {
                  studioLayout: { ...studioLayout, comments: event.target.value as StudioLayoutValue["comments"] }
                })
              }
            >
              <option value="left">{copy.studioLayout.comments.options.left}</option>
              <option value="right">{copy.studioLayout.comments.options.right}</option>
              <option value="hidden">{copy.studioLayout.comments.options.hidden}</option>
            </select>
          </label>

          <label>
            <span className="field-note">{copy.studioLayout.transcript.label}</span>
            <select
              className="search-input"
              value={studioLayout.transcript ?? "left"}
              disabled={!experience.studioLayout.editable}
              onChange={(event) =>
                void commit("studioLayout.transcript", {
                  studioLayout: { ...studioLayout, transcript: event.target.value as StudioLayoutValue["transcript"] }
                })
              }
            >
              <option value="left">{copy.studioLayout.transcript.options.left}</option>
              <option value="right">{copy.studioLayout.transcript.options.right}</option>
              <option value="hidden">{copy.studioLayout.transcript.options.hidden}</option>
            </select>
          </label>

          <label>
            <span className="field-note">{copy.studioLayout.timelineHeight.label}</span>
            <input
              className="search-input"
              type="number"
              min={160}
              max={720}
              dir="ltr"
              value={timelineHeightDraft}
              disabled={!experience.studioLayout.editable}
              onChange={(event) => setTimelineHeightDraft(event.target.value)}
              onBlur={() => {
                const parsed = Number(timelineHeightDraft);
                if (Number.isInteger(parsed) && parsed !== studioLayout.timelineHeight) {
                  void commit("studioLayout.timelineHeight", { studioLayout: { ...studioLayout, timelineHeight: parsed } });
                }
              }}
            />
            <span className="helper-text">{copy.studioLayout.timelineHeight.hint}</span>
          </label>
        </div>

        <fieldset className="stack mt-tight">
          <legend className="field-note">{copy.studioLayout.panels.label}</legend>
          {(["comments", "transcript", "timeline", "metadata"] as const).map((panel) => (
            <label className="checkbox-label" key={panel}>
              <input
                type="checkbox"
                checked={(studioLayout.panels ?? []).includes(panel)}
                disabled={!experience.studioLayout.editable}
                onChange={(event) => togglePanel(panel, event.target.checked)}
              />
              {copy.studioLayout.panels.options[panel]}
            </label>
          ))}
        </fieldset>
        {fieldError("studioLayout.comments")}
        {fieldError("studioLayout.transcript")}
        {fieldError("studioLayout.timelineHeight")}
        {fieldError("studioLayout.panels")}
      </div>

      <div className="section-divider">
        <strong>{copy.shortcuts.heading}</strong>
        <div className="settings-hub__field-grid mt-tight">
          {(["playPause", "seekForward", "seekBackward", "nextComment", "previousComment"] as const).map((shortcutKey) => (
            <label key={shortcutKey}>
              <span className="field-note">{copy.shortcuts[shortcutKey]}</span>
              <input
                className="search-input"
                dir="ltr"
                value={shortcutDrafts[shortcutKey] ?? ""}
                disabled={!experience.shortcuts.editable}
                onChange={(event) => setShortcutDrafts((current) => ({ ...current, [shortcutKey]: event.target.value }))}
                onBlur={() => {
                  if (shortcutDrafts[shortcutKey] !== shortcuts[shortcutKey]) {
                    void commit("shortcuts", { shortcuts: { ...shortcuts, [shortcutKey]: shortcutDrafts[shortcutKey] } });
                  }
                }}
              />
            </label>
          ))}
        </div>
        {fieldError("shortcuts")}
      </div>

      <div className="section-divider">
        <strong>{copy.views.heading}</strong>
        <div className="settings-hub__field-grid mt-tight">
          <label>
            <span className="field-note">{copy.views.mode.label}</span>
            <select
              className="search-input"
              value={archiveView.mode ?? "table"}
              disabled={!experience.views.editable}
              onChange={(event) =>
                void commit("views.mode", { views: { archive: { ...archiveView, mode: event.target.value as "table" | "grid" } } })
              }
            >
              <option value="table">{copy.views.mode.options.table}</option>
              <option value="grid">{copy.views.mode.options.grid}</option>
            </select>
          </label>

          <label>
            <span className="field-note">{copy.views.pageSize.label}</span>
            <input
              className="search-input"
              type="number"
              min={1}
              max={200}
              dir="ltr"
              value={pageSizeDraft}
              disabled={!experience.views.editable}
              onChange={(event) => setPageSizeDraft(event.target.value)}
              onBlur={() => {
                const parsed = Number(pageSizeDraft);
                if (Number.isInteger(parsed) && parsed !== archiveView.pageSize) {
                  void commit("views.pageSize", { views: { archive: { ...archiveView, pageSize: parsed } } });
                }
              }}
            />
            <span className="helper-text">{copy.views.pageSize.hint}</span>
          </label>
        </div>
        <p className="helper-text mt-tight">
          {copy.views.columnsSummaryTemplate.replace("{count}", String(archiveView.columns?.length ?? 0))}
          {" — "}
          {copy.views.savedSearchSummary.replace("{value}", archiveView.defaultSavedSearchId ?? copy.views.savedSearchNone)}
        </p>
        {fieldError("views.mode")}
        {fieldError("views.pageSize")}
      </div>
    </section>
  );
}
