"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, PauseCircle, RefreshCw } from "lucide-react";
import { StateNotice } from "@/components/operations/StateNotice";
import { createArchiveApiClient, type MediaToolchainComponent, type MediaToolchainComponentKey, type MediaToolchainComponentStatus } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import styles from "./jobs.module.css";

type ToolchainState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "loaded"; checkedAt: string; components: MediaToolchainComponent[] }
  | { status: "error"; message: string };

/**
 * SYSTEM_COVERAGE.md's outstanding-scope gap: an independent status panel
 * for each media-operations toolchain component (ffmpeg, ffprobe, whisper,
 * reverb, gpu, connectors), each in one of three states --
 * available/needs_configuration/stopped -- backed by GET
 * /system/media-toolchain. Every state pairs a text label and an icon so
 * meaning never rests on color alone (see DESIGN.md's color rule).
 */
export function MediaToolchainStatus() {
  const { locale, t } = useLocale();
  const copy = t.pages.mediaJobs.toolchainStatus;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ToolchainState>({ status: "loading" });

  const componentLabel = (key: MediaToolchainComponentKey) =>
    (copy.components as Record<string, string>)[key] ?? key;
  const statusLabel = (status: MediaToolchainComponentStatus) =>
    (copy.statuses as Record<string, string>)[status] ?? status;

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const response = await api.mediaToolchainStatus();

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    if (response.components.length === 0) {
      setState({ status: "empty" });
      return;
    }

    setState({ status: "loaded", checkedAt: response.checkedAt, components: response.components });
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="workspace-panel" aria-label={copy.ariaLabel}>
      <div className="workspace-panel__header">
        <div>
          <h2>{copy.title}</h2>
          <p className="field-note">{copy.description}</p>
        </div>
        <button className="button button-secondary button-sm" type="button" onClick={() => void load()}>
          <RefreshCw size={16} aria-hidden="true" />
          {copy.refresh}
        </button>
      </div>

      {state.status === "loading" && <StateNotice state="loading" title={copy.loading} />}

      {state.status === "empty" && (
        <StateNotice
          state="empty"
          title={copy.empty}
          description={copy.emptyDescription}
          actions={(
            <button className="button button-secondary button-sm" type="button" onClick={() => void load()}>
              {copy.retry}
            </button>
          )}
        />
      )}

      {state.status === "error" && (
        <StateNotice
          state="error"
          title={copy.loadError.replace("{error}", state.message)}
          actions={(
            <button className="button button-secondary button-sm" type="button" onClick={() => void load()}>
              {copy.retry}
            </button>
          )}
        />
      )}

      {state.status === "loaded" && (
        <div className="stack">
          <ul className={styles.toolchainGrid} aria-label={copy.ariaLabel}>
            {state.components.map((component) => (
              <li key={component.key} className={styles.toolchainCard} data-status={component.status}>
                <div className="toolbar-row">
                  <strong>{componentLabel(component.key)}</strong>
                  <span className="badge">
                    <ToolchainStatusIcon status={component.status} />
                    {statusLabel(component.status)}
                  </span>
                </div>
                <p className="field-note">{component.detail}</p>
                {component.configHint && <p className="helper-text">{component.configHint}</p>}
              </li>
            ))}
          </ul>
          <div className="helper-row">
            <Clock3 size={14} aria-hidden="true" />
            <span className="field-note">
              {copy.checkedAtLabel}: <time dateTime={state.checkedAt}>{new Date(state.checkedAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA")}</time>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function ToolchainStatusIcon({ status }: { status: MediaToolchainComponentStatus }) {
  if (status === "available") return <CheckCircle2 size={14} aria-hidden="true" />;
  if (status === "needs_configuration") return <AlertTriangle size={14} aria-hidden="true" />;
  return <PauseCircle size={14} aria-hidden="true" />;
}
