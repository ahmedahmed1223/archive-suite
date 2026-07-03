"use client";

import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/css";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { asChild = false, className, size = "md", variant = "secondary", ...props },
  ref
) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      ref={ref}
      className={cx("ui-button", `ui-button-${variant}`, `ui-button-${size}`, className)}
      {...props}
    />
  );
});

export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "size">>(function IconButton(
  { className, variant = "ghost", ...props },
  ref
) {
  return <Button ref={ref} className={cx("ui-icon-button", className)} size="icon" variant={variant} {...props} />;
});
