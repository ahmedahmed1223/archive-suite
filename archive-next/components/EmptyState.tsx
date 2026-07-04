import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  description,
  actions
}: Readonly<{
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}>) {
  return (
    <div className="empty-state empty-state-rich">
      {icon ? <div className="empty-state__icon" aria-hidden="true">{icon}</div> : null}
      <strong>{title}</strong>
      {description ? <p className="helper-text">{description}</p> : null}
      {actions ? <div className="button-row">{actions}</div> : null}
    </div>
  );
}
