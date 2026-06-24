/**
 * ToastV2 — Design System v2 toast notification.
 *
 * Accessible, portal-rendered, RTL-safe, token-driven.
 * Positions: top-center | bottom-right | bottom-left (default: bottom-right).
 * Variants: success | error | warning | info.
 * Auto-dismisses after `duration` ms (default 4000). Pass duration=0 to persist.
 *
 * Animate via CSS transitions on opacity + transform (compositor-only, no layout).
 *
 * @module ToastV2
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

/* ── Variant config ── */

const VARIANT_STYLES = {
  success:
    "border-[var(--va-status-success)] bg-[color-mix(in_oklab,var(--va-status-success)_10%,var(--va-elevated))] text-[var(--va-status-success-text,var(--va-status-success))]",
  error:
    "border-[var(--va-status-danger)] bg-[color-mix(in_oklab,var(--va-status-danger)_10%,var(--va-elevated))] text-[var(--va-status-danger)]",
  warning:
    "border-[var(--va-status-warning)] bg-[color-mix(in_oklab,var(--va-status-warning)_10%,var(--va-elevated))] text-[var(--va-status-warning-text,var(--va-status-warning))]",
  info:
    "border-[var(--va-status-info)] bg-[color-mix(in_oklab,var(--va-status-info)_10%,var(--va-elevated))] text-[var(--va-status-info-text,var(--va-status-info))]",
};

const VARIANT_ICONS = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />,
  error:   <AlertCircle  className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />,
  info:    <Info          className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />,
};

/* ── Position config (uses CSS logical properties for RTL safety) ── */

const POSITION_STYLES = {
  "top-center": {
    top: "var(--va-space-4, 1rem)",
    insetInlineStart: "50%",
    transform: "translateX(-50%)",
    bottom: "auto",
  },
  "bottom-right": {
    bottom: "var(--va-space-4, 1rem)",
    insetInlineEnd: "var(--va-space-4, 1rem)",
    top: "auto",
  },
  "bottom-left": {
    bottom: "var(--va-space-4, 1rem)",
    insetInlineStart: "var(--va-space-4, 1rem)",
    top: "auto",
  },
};

const ENTER_VARIANTS = {
  "top-center":   { initial: { opacity: 0, y: -16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } },
  "bottom-right": { initial: { opacity: 0, y: 16 },  animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 12 } },
  "bottom-left":  { initial: { opacity: 0, y: 16 },  animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 12 } },
};

const TRANSITION = { duration: 0.2, ease: [0.22, 1, 0.36, 1] };

/**
 * ToastV2 — single toast item.
 *
 * @param {{ message: string, variant?: 'success'|'error'|'warning'|'info', duration?: number, onClose?: () => void, position?: 'top-center'|'bottom-right'|'bottom-left' }} props
 */
export function ToastV2({
  message,
  variant = "info",
  duration = 4000,
  onClose,
  position = "bottom-right",
}) {
  const resolvedVariant = VARIANT_STYLES[variant] ? variant : "info";
  const posStyle = POSITION_STYLES[position] || POSITION_STYLES["bottom-right"];
  const motion_ = ENTER_VARIANTS[position] || ENTER_VARIANTS["bottom-right"];

  /* Auto-dismiss */
  React.useEffect(() => {
    if (!onClose || !duration) return undefined;
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [onClose, duration]);

  /* Keyboard dismiss via Escape */
  React.useEffect(() => {
    if (!onClose) return undefined;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      role="alert"
      aria-live={resolvedVariant === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      dir="rtl"
      style={{
        position: "fixed",
        zIndex: "var(--va-z-toast, 9000)",
        minWidth: "18rem",
        maxWidth: "calc(100vw - 2rem)",
        ...posStyle,
      }}
      className={cx(
        "flex items-start gap-2.5 rounded-[var(--va-radius-lg)] border px-4 py-3 text-sm shadow-[var(--va-elev-popover)]",
        VARIANT_STYLES[resolvedVariant]
      )}
      initial={motion_.initial}
      animate={motion_.animate}
      exit={motion_.exit}
      transition={TRANSITION}
    >
      {VARIANT_ICONS[resolvedVariant]}
      <span className="flex-1 text-[var(--va-text)]">{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق الإشعار"
          className="shrink-0 rounded-[var(--va-radius-sm)] p-0.5 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </motion.div>,
    document.body
  );
}

/**
 * ToastContainer — renders a stack of active toasts from the useToast hook.
 * Place once near the app root (or inside AppNotifications).
 *
 * @param {{ toasts: Array, onDismiss: (id: string) => void }} props
 */
export function ToastContainer({ toasts = [], onDismiss }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence mode="sync">
      {toasts.map((toast) => (
        <ToastV2
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={toast.duration}
          position={toast.position}
          onClose={() => onDismiss?.(toast.id)}
        />
      ))}
    </AnimatePresence>,
    document.body
  );
}
