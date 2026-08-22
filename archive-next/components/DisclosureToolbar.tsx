"use client";

import { useState, type ReactNode } from "react";

// V14-UX-005 (Task 5): progressive disclosure for advanced filters.
// A semantic <details> keeps keyboard support and DOM presence; the state
// mirror only lets React re-render content that depends on openness.
export default function DisclosureToolbar({
  summary,
  children,
  defaultOpen = false
}: Readonly<{
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}>) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="disclosure-toolbar"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="button button-secondary">{summary}</summary>
      <div className="disclosure-toolbar__content">{children}</div>
    </details>
  );
}
