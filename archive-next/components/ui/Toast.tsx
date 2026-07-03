"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/css";

export const ToastProvider = ToastPrimitive.Provider;
export const Toast = ToastPrimitive.Root;
export const ToastTitle = ToastPrimitive.Title;
export const ToastDescription = ToastPrimitive.Description;
export const ToastAction = ToastPrimitive.Action;
export const ToastClose = ToastPrimitive.Close;

export function ToastViewport({ className, ...props }: ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>) {
  return <ToastPrimitive.Viewport className={cx("ui-toast-viewport", className)} {...props} />;
}
