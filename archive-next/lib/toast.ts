"use client";

import { useSyncExternalStore } from "react";

export type ToastTone = "success" | "error" | "info";

export type ToastAction = {
  label: string;
  onAction: () => void;
};

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return items;
}

/** Fire a toast from any client component or event handler. */
export function toast(message: string, tone: ToastTone = "info", action?: ToastAction) {
  const id = nextId++;
  items = [...items, { id, message, tone, action }];
  emit();
  return id;
}

export const toastSuccess = (message: string, action?: ToastAction) => toast(message, "success", action);
export const toastError = (message: string, action?: ToastAction) => toast(message, "error", action);

export function dismissToast(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

/** Subscribe to the live toast list (concurrent-safe). */
export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => items);
}
