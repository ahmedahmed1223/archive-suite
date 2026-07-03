"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/css";

export function FieldError({ children }: Readonly<{ children?: ReactNode }>) {
  if (!children) {
    return null;
  }

  return (
    <span className="ui-field-error" role="alert">
      {children}
    </span>
  );
}

export function FormHint({ children, className }: Readonly<{ children?: ReactNode; className?: string }>) {
  if (!children) {
    return null;
  }

  return <span className={cx("ui-form-hint", className)}>{children}</span>;
}
