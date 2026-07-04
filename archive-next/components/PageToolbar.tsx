import type { ReactNode } from "react";

export default function PageToolbar({
  icon,
  eyebrow,
  title,
  description,
  meta,
  actions,
  children,
  tone = "default",
  density = "normal"
}: Readonly<{
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: "default" | "accent" | "system" | "danger";
  density?: "normal" | "compact";
}>) {
  return (
    <header
      className="page-toolbar"
      data-tone={tone}
      data-density={density}
      data-has-actions={actions ? "true" : "false"}
      data-has-controls={children ? "true" : "false"}
      data-has-meta={meta ? "true" : "false"}
      data-has-icon={icon ? "true" : "false"}
    >
      <div className="page-toolbar__main">
        {eyebrow ? <div className="page-toolbar__eyebrow">{eyebrow}</div> : null}
        <div className="page-toolbar__title-row">
          {icon ? <div className="page-toolbar__icon" aria-hidden="true">{icon}</div> : null}
          <div className="page-toolbar__title-stack">
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="page-toolbar__actions">{actions}</div> : null}
        </div>
        {meta ? <div className="page-toolbar__meta">{meta}</div> : null}
      </div>
      {children ? <div className="page-toolbar__controls">{children}</div> : null}
    </header>
  );
}
