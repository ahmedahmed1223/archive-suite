"use client";

import { useState } from "react";

type ExportDrawerProps = {
  projectId: string;
  currentRevision: number;
  /** Server-side QC verdict; the export button stays disabled until ready. */
  qcReady: boolean;
  onRunQc?: () => Promise<void>;
  onRequestExport: (preset: "web-1080p" | "web-4k" | "archive-master") => void;
};

const PRESETS = [
  { value: "web-1080p", label: "ويب 1080p" },
  { value: "web-4k", label: "ويب 4K" },
  { value: "archive-master", label: "نسخة الأرشيف" },
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
}: ExportDrawerProps) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["value"]>("web-1080p");
  const [qcPending, setQcPending] = useState(false);

  const runQc = async () => {
    setQcPending(true);
    try {
      await onRunQc?.();
    } finally {
      setQcPending(false);
    }
  };

  return (
    <aside aria-label="درج التصدير" className="export-drawer">
      <h2>تصدير المشروع</h2>

      <div role="group" aria-label="اختيار جودة التصدير">
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
        فحص المشروع
      </button>

      <button
        type="button"
        className="export-drawer__start"
        disabled={!qcReady || qcPending}
        onClick={() => onRequestExport(preset)}
        title={
          !qcReady
            ? "يجب اجتياز فحص المشروع قبل بدء التصدير"
            : `سيُصدَّر المشروع عند المراجعة ${currentRevision}`
        }
      >
        بدء التصدير
      </button>

      <p className="export-drawer__hint">
        سيُصدَّر المشروع «{projectId}» عند المراجعة رقم {currentRevision}. أي تعديل جديد يتطلب فحصًا
        جديدًا.
      </p>
    </aside>
  );
}
