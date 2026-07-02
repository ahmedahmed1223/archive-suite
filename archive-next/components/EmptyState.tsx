import type { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  actions
}: Readonly<{
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}>) {
  return (
    <div className="empty-state empty-state-rich">
      <strong>{title}</strong>
      {description ? <p className="helper-text">{description}</p> : null}
      {actions ? <div className="button-row">{actions}</div> : null}
    </div>
  );
}
