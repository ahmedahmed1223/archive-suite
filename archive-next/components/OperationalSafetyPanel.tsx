import { buildOperationalSafety, type OperationalSafetyInput } from "@/lib/operational-safety";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = OperationalSafetyInput & {
  className?: string;
  onConfirm?: () => void;
};

export default function OperationalSafetyPanel({ className = "", onConfirm, ...input }: Readonly<Props>) {
  const { t } = useLocale();
  const safety = buildOperationalSafety(input);

  return (
    <aside className={`state-banner ${safety.isBlocked ? "state-banner-error" : ""} ${className}`} aria-label={t.shell.operationalSafety.ariaLabel} role={safety.isBlocked ? "alert" : "status"}>
      <div className="panel-title-row">
        <strong>{t.shell.operationalSafety.title}</strong>
        <span className="badge">{safety.modeLabel}</span>
      </div>
      <p className="helper-text">{safety.summary}</p>
      {safety.blockedLabel ? <p className="helper-text"><strong>{safety.blockedLabel}</strong></p> : null}
      {safety.rightsReviewLabel ? <p className="helper-text">{safety.rightsReviewLabel}</p> : null}
      {safety.confidenceLabel ? <p className="helper-text">{safety.confidenceLabel}</p> : null}
      <p className="helper-text">{safety.nextStep}</p>
      <div className="toolbar-row toolbar-start">
        {safety.requiresConfirmation && onConfirm ? (
          <button type="button" className="button button-secondary button-sm" onClick={onConfirm}>
            {safety.confirmationLabel}
          </button>
        ) : null}
        {safety.showAuditLink ? <a className="button button-secondary button-sm" href={safety.auditHref}>{safety.auditLabel}</a> : null}
      </div>
    </aside>
  );
}
