"use client";

import type { ChangeImpact } from "@/lib/change-impact";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function ChangeImpactPreview({ impact }: Readonly<{ impact: ChangeImpact }>) {
  const { t } = useLocale();
  const copy = t.shared.changeImpactPreview;
  const className = impact.tone === "danger"
    ? "state-banner state-banner-error"
    : impact.tone === "warning"
      ? "state-banner"
      : "state-banner";

  return (
    <div className={className} role={impact.tone === "danger" ? "alert" : "status"} aria-live="polite">
      <strong>{copy.introduction} {impact.summary}</strong>
      <span className="helper-text">{impact.detail}</span>
      {impact.undoLabel ? <span className="badge">{impact.undoLabel} {copy.available}</span> : null}
    </div>
  );
}
