/**
 * useToast — Design System v2 toast queue hook.
 *
 * Returns { toasts, showToast, dismissToast, ToastContainer }.
 *
 * - showToast({ message, variant, duration, position }) queues a toast
 * - Max 3 toasts visible at once; the oldest is dropped when the limit is exceeded
 * - ToastContainer is a convenience component that renders the active queue
 *
 * @example
 * function MyPage() {
 *   const { showToast, ToastContainer } = useToast();
 *
 *   return (
 *     <>
 *       <button onClick={() => showToast({ message: 'تم الحفظ', variant: 'success' })}>
 *         حفظ
 *       </button>
 *       <ToastContainer />
 *     </>
 *   );
 * }
 */
import * as React from "react";
import { ToastContainer as ToastContainerComponent } from "../components/ui/ToastV2.jsx";

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 4000;

let _idCounter = 0;
function nextId() {
  _idCounter += 1;
  return `toast-${_idCounter}`;
}

/**
 * @returns {{ toasts: Array, showToast: (opts: object) => string, dismissToast: (id: string) => void, ToastContainer: React.FC }}
 */
export function useToast() {
  const [toasts, setToasts] = React.useState([]);

  const dismissToast = React.useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = React.useCallback(
    ({ message, variant = "info", duration = DEFAULT_DURATION, position = "bottom-right" }) => {
      const id = nextId();

      setToasts((prev) => {
        const next = [
          ...prev,
          { id, message, variant, duration, position },
        ];
        // Drop oldest entries when over cap
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });

      // Auto-dismiss at the hook level when duration > 0
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  /* Bind the container to this hook's queue so callers get a zero-config component */
  const ToastContainer = React.useCallback(
    () =>
      React.createElement(ToastContainerComponent, {
        toasts,
        onDismiss: dismissToast,
      }),
    [toasts, dismissToast]
  );

  return { toasts, showToast, dismissToast, ToastContainer };
}
