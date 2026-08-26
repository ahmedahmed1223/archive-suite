"use client";

import { useState } from "react";

export type ExportDrawerCopy = {
  drawerAriaLabel: string;
  title: string;
  presetGroupLabel: string;
  runQc: string;
  startExport: string;
  qcRequiredHint: string;
};

type ExportDrawerProps = {
  projectId: string;
  currentRevision: number;
  /** Server-side QC verdict; the export button stays disabled until ready. */
  qcReady: boolean;
  onRunQc?: () => Promise<void>;
  onRequestExport: (preset: "web-1080p" | "web-4k" | "archive-master") => void;
  copy: ExportDrawerCopy;
};

const PRESETS = [
  { value: "web-1080p", label: "Web 1080p" },
  { value: "web-4k", label: "Web 4K" },
  { value: "archive-master", label: "Archive master" },
] as const;

/**
 * V1.5 Task 6: export drawer.
 * The export button stays disabled until the server QC response is ready —
 * a failed check never reaches FFmpeg. Presets are the server allowlist only.
 */
export default function ExportDrawer({
  projectId,
  currentRevision,
  qcReady,
  onRunQc,
  onRequestExport,
  copy,
}: ExportDrawerProps) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["value"]>("web-1080p");
  const [qcPending, setQcPending] = useState(false);
  const locale = useLocaleSafe();

  const runQc = async () => {
    setQcPending(true);
    try {
      await onRunQc?.();
    } finally {
      setQcPending(false);
    }
  };

  return (
    <aside aria-label={copy.drawerAriaLabel} className="export-drawer">
      <h2>{copy.title}</h2>

      <div role="group" aria-label={copy.presetGroupLabel}>
        {PRESETS.map((p) => (
          <label key={p.value} className="export-drawer__preset">
            <input
              type="radio"
              name="export-preset"
              value={p.value}
              checked={preset === p.value}
              onChange={() => setPreset(p.value)}
            />
            <span dir="auto">{p.label}</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        className="export-drawer__qc"
        onClick={() => void runQc()}
        disabled={qcPending}
      >
        {copy.runQc}
      </button>

      <button
        type="button"
        className="export-drawer__start"
        disabled={!qcReady || qcPending}
        onClick={() => onRequestExport(preset)}
        title={!qcReady ? copy.qcRequiredHint : undefined}
      >
        {copy.startExport}
      </button>
    </aside>
  );
}

// Local import shim to keep this file self-contained without a circular dep.
import { useLocale } from "@/lib/i18n/LocaleProvider";
function useLocaleSafe(): "ar" | "en" {
  try {
    const ctx = useLocale();
    return (ctx as unknown as { locale?: "ar" | "en" }).locale ?? "ar";
  } catch {
    return "ar";
  }
}
