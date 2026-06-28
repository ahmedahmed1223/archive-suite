import * as React from "react";

import { ToastContainer as ToastContainerComponent } from "../components/ui/ToastV2.jsx";

interface Toast {
  id: string;
  message: string;
  variant: string;
  duration: number;
  position: string;
}

interface ToastOptions {
  message: string;
  variant?: string;
  duration?: number;
  position?: string;
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 4000;

let _idCounter = 0;
function nextId() {
  _idCounter += 1;
  return `toast-${_idCounter}`;
}

export function useToast() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = React.useCallback(
    ({ message, variant = "info", duration = DEFAULT_DURATION, position = "bottom-right" }: ToastOptions) => {
      const id = nextId();

      setToasts((prev) => {
        const next = [...prev, { id, message, variant, duration, position }];
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const ToastContainer = React.useCallback(
    () =>
      React.createElement(ToastContainerComponent as React.ComponentType<ToastContainerProps>, {
        toasts,
        onDismiss: dismissToast,
      }),
    [toasts, dismissToast]
  );

  return { toasts, showToast, dismissToast, ToastContainer };
}
