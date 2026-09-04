import { useId, type ReactNode } from "react";

export interface OperationalPageProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  actionsLabel?: string;
  status?: ReactNode;
  contentLabel?: string;
  children?: ReactNode;
}

export function OperationalPage({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryActions,
  actionsLabel = "إجراءات الصفحة",
  status,
  contentLabel,
  children
}: Readonly<OperationalPageProps>) {
  const headingId = useId();

  return (
    <section className="operational-page" aria-labelledby={headingId}>
      <header className="operational-page__header">
        {eyebrow ? <p className="operational-page__eyebrow">{eyebrow}</p> : null}
        <div className="operational-page__heading">
          <h1 id={headingId}>{title}</h1>
          {description ? <p className="operational-page__description">{description}</p> : null}
        </div>
        {primaryAction || secondaryActions ? (
          <div className="operational-page__actions" role="group" aria-label={actionsLabel}>
            {primaryAction ? <div className="operational-page__primary-action">{primaryAction}</div> : null}
            {secondaryActions ? <div className="operational-page__secondary-actions">{secondaryActions}</div> : null}
          </div>
        ) : null}
        {status ? <p className="operational-page__status" role="status" aria-live="polite">{status}</p> : null}
      </header>
      {children ? (
        <div
          className="operational-page__content"
          {...(contentLabel ? { role: "region", "aria-label": contentLabel } : {})}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
