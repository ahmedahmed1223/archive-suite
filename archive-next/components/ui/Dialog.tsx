"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/css";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className,
  title,
  description,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-dialog-overlay" />
      <DialogPrimitive.Content className={cx("ui-dialog-content", className)} {...props}>
        <div className="ui-dialog-heading">
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          {description ? <DialogPrimitive.Description>{description}</DialogPrimitive.Description> : null}
        </div>
        <DialogPrimitive.Close className="ui-dialog-close" aria-label="إغلاق">
          <X aria-hidden="true" size={18} />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
