import type { ChangeImpact } from "@/lib/change-impact";

export default function ChangeImpactPreview({ impact }: Readonly<{ impact: ChangeImpact }>) {
  const className = impact.tone === "danger"
    ? "state-banner state-banner-error"
    : impact.tone === "warning"
      ? "state-banner"
      : "state-banner";

  return (
    <div className={className} role={impact.tone === "danger" ? "alert" : "status"} aria-live="polite">
      <strong>معاينة التأثير: {impact.summary}</strong>
      <span className="helper-text">{impact.detail}</span>
      {impact.undoLabel ? <span className="badge">{impact.undoLabel} متاح</span> : null}
    </div>
  );
}
