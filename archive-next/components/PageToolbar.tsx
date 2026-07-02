import type { ReactNode } from "react";

export default function PageToolbar({
  eyebrow,
  title,
  description,
  meta,
  actions,
  children
}: Readonly<{
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}>) {
  return (
    <header className="page-toolbar">
      <div className="page-toolbar__main">
        {eyebrow ? <div className="page-toolbar__eyebrow">{eyebrow}</div> : null}
        <div className="page-toolbar__title-row">
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
