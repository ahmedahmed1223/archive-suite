import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ToastVariant = "success" | "error" | "warning" | "info";
type ToastPosition = "top-center" | "bottom-right" | "bottom-left";

export interface ToastV2Props {
  message: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
  onClose?: () => void;
  position?: ToastPosition;
}

export interface ToastContainerProps {
  toasts?: Array<{
    id: string;
    message: React.ReactNode;
    variant?: ToastVariant;
    duration?: number;
    position?: ToastPosition;
  }>;
  onDismiss?: (id: string) => void;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success:
    "border-[var(--va-status-success)] bg-[color-mix(in_oklab,var(--va-status-success)_10%,var(--va-elevated))] text-[var(--va-status-success-text,var(--va-status-success))]",
  error:
    "border-[var(--va-status-danger)] bg-[color-mix(in_oklab,var(--va-status-danger)_10%,var(--va-elevated))] text-[var(--va-status-danger)]",
  warning:
    "border-[var(--va-status-warning)] bg-[color-mix(in_oklab,var(--va-status-warning)_10%,var(--va-elevated))] text-[var(--va-status-warning-text,var(--va-status-warning))]",
  info:
    "border-[var(--va-status-info)] bg-[color-mix(in_oklab,var(--va-status-info)_10%,var(--va-elevated))] text-[var(--va-status-info-text,var(--va-status-info))]",
};

const VARIANT_ICONS: Record<ToastVariant, React.ReactElement> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />,
  error: <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />,
  info: <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />,
};

const POSITION_STYLES: Record<ToastPosition, React.CSSProperties> = {
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

const ENTER_VARIANTS: Record<
  ToastPosition,
  { initial: { opacity: number; y: number }; animate: { opacity: number; y: number }; exit: { opacity: number; y: number } }
> = {
  "top-center": {
    initial: { opacity: 0, y: -16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
  },
  "bottom-right": {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 12 },
  },
  "bottom-left": {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 12 },
  },
};

const TRANSITION = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

export function ToastV2({
  message,
  variant = "info",
  duration = 4000,
  onClose,
  position = "bottom-right",
}: ToastV2Props) {
  const resolvedVariant = VARIANT_STYLES[variant] ? variant : "info";
  const posStyle = POSITION_STYLES[position] || POSITION_STYLES["bottom-right"];
  const motion_ = ENTER_VARIANTS[position] || ENTER_VARIANTS["bottom-right"];

  React.useEffect(() => {
    if (!onClose || !duration) return undefined;
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [onClose, duration]);

  React.useEffect(() => {
    if (!onClose) return undefined;
    const handleKey = (e: KeyboardEvent) => {
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

export function ToastContainer({ toasts = [], onDismiss }: ToastContainerProps) {
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
