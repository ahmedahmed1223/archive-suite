/**
 * In-house UI primitives — "Layered Editorial Bento" design language.
 *
 * Token-driven (var(--va-*) from design-tokens.css / app-overrides.css), RTL-first,
 * accessibility baked in. Accent colors use Tailwind `emerald-*` utilities, which
 * are remapped to the teal accent ramp at runtime by theme/accentColor.js — so they
 * follow the accent picker with zero edits.
 *
 * This is the shared foundation every page/surface re-skin builds on. Re-exported
 * from components/ui/index.js.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { cx } from "./V1Primitives.jsx";
import { dialogMotion, overlayMotion } from "./motion.js";

/* ───────────────────────────── Button ───────────────────────────── */

const BUTTON_VARIANTS = {
  primary:
    "bg-emerald-500 text-[var(--va-text-inverse)] hover:bg-emerald-600 active:bg-emerald-700 border border-transparent",
  secondary:
    "bg-[var(--va-surface)] text-[var(--va-text)] border border-[var(--va-border-strong)] hover:bg-[var(--va-elevated)]",
  ghost:
    "bg-transparent text-[var(--va-text-2)] border border-transparent hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]",
  highlight:
    "bg-[var(--va-highlight)] text-[#3a2a08] hover:brightness-105 border border-transparent",
  danger:
    "bg-[var(--va-status-danger)] text-white hover:brightness-110 border border-transparent",
  subtle:
    "bg-emerald-500/12 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/18",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2.5",
  icon: "h-10 w-10 justify-center",
};

export function Button({
  as: Component = "button",
  variant = "secondary",
  size = "md",
  isLoading = false,
  leadingIcon = null,
  trailingIcon = null,
  fullWidth = false,
  className = "",
  disabled = false,
  children,
  ref,
  ...props
}: any) {
  const isButton = Component === "button";
  return (
    <Component
      ref={ref}
      type={isButton ? props.type || "button" : undefined}
      disabled={isButton ? disabled || isLoading : undefined}
      aria-busy={isLoading || undefined}
      className={cx(
        "inline-flex items-center justify-center rounded-[var(--va-radius-md)] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-bg)]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        (BUTTON_VARIANTS as any)[variant] || BUTTON_VARIANTS.secondary,
        (BUTTON_SIZES as any)[size] || BUTTON_SIZES.md,
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : leadingIcon}
      {children}
      {trailingIcon}
    </Component>
  );
}

/* ───────────────────────────── Surface / Card ───────────────────────────── */

const ELEVATION = {
  0: "bg-[var(--va-surface)] border border-[var(--va-border-soft)]",
  1: "bg-[var(--va-surface)] border border-[var(--va-border-soft)] shadow-[var(--va-elev-1)]",
  2: "bg-[var(--va-elevated)] border border-[var(--va-border-soft)] shadow-[var(--va-elev-2)]",
};

export function Surface({
  as: Component = "div",
  elevation = 0,
  interactive = false,
  padding = "p-[var(--va-pad-card)]",
  className = "",
  children,
  ref,
  ...props
}: any) {
  return (
    <Component
      ref={ref}
      dir="rtl"
      className={cx(
        "rounded-[var(--va-radius-lg)] text-[var(--va-text)]",
        (ELEVATION as any)[elevation] || ELEVATION[0],
        padding,
        interactive &&
          "transition-colors hover:border-emerald-500/30 focus-within:border-emerald-500/30",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

/* ───────────────────────────── Badge ───────────────────────────── */

const BADGE_TONES = {
  neutral: "bg-[var(--va-surface-2)] text-[var(--va-text-2)] border-[var(--va-border-soft)]",
  accent: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  highlight: "bg-[var(--va-highlight-soft)] text-[var(--va-highlight)] border-[color-mix(in_oklab,var(--va-highlight)_30%,transparent)]",
  info: "bg-blue-500/12 text-blue-300 border-blue-500/25",
  success: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  warning: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  danger: "bg-rose-500/12 text-rose-300 border-rose-500/25",
};

export function Badge({ tone = "neutral", className = "", children, ...props }: any) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        (BADGE_TONES as any)[tone] || BADGE_TONES.neutral,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* ───────────────────────────── Skeleton ───────────────────────────── */

export function Skeleton({ className = "", rounded = "rounded-[var(--va-radius-md)]" }: any) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse bg-[var(--va-surface-2)]", rounded, className)}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: any) {
  return (
    <div className={cx("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_: any, i: any) => (
        <Skeleton key={i} className={cx("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: any) {
  return (
    <Surface elevation={0} className={className}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" rounded="rounded-[var(--va-radius-md)]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonText lines={2} className="mt-4" />
    </Surface>
  );
}

/* ───────────────────────────── EmptyState (canonical) ───────────────────────────── */

export function EmptyState({
  icon = null,
  title,
  description,
  actions = null,
  variant = "default",
  className = "",
}: any) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      dir="rtl"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx(
        "flex flex-col items-center justify-center rounded-[var(--va-radius-lg)] px-6 py-12 text-center",
        variant === "default" && "border border-dashed border-[var(--va-border-strong)] bg-[var(--va-surface)]",
        className
      )}
      role="status"
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] text-[var(--va-text-muted)]">
          {icon}
        </div>
      )}
      {title && <h3 className="text-lg font-medium text-[var(--va-text)]">{title}</h3>}
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--va-text-muted)]">{description}</p>
      )}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </motion.section>
  );
}

/* ───────────────────────────── Form fields ───────────────────────────── */

const CONTROL_BASE =
  "w-full rounded-[var(--va-radius-md)] border bg-[var(--va-surface)] text-[var(--va-text)] placeholder:text-[var(--va-text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 disabled:cursor-not-allowed disabled:opacity-55";

function controlBorder(error: any) {
  return error ? "border-[var(--va-status-danger)]" : "border-[var(--va-border-strong)] focus-visible:border-emerald-500/60";
}

export function Field({ label, htmlFor, hint, error, required = false, className = "", children }: any) {
  return (
    <div className={cx("space-y-1.5 text-start", className)} dir="rtl">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--va-text-2)]">
          {label}
          {required && <span className="me-1 text-[var(--va-status-danger)]">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-[var(--va-status-danger)]" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--va-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ error = false, className = "", ref, ...props }: any) {
  return (
    <input
      ref={ref}
      aria-invalid={error || undefined}
      className={cx(CONTROL_BASE, controlBorder(error), "h-10 px-3 text-sm va-bidi-input", className)}
      {...props}
    />
  );
}

export function Textarea({ error = false, className = "", rows = 4, ref, ...props }: any) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={error || undefined}
      className={cx(CONTROL_BASE, controlBorder(error), "px-3 py-2 text-sm leading-6 va-bidi-input", className)}
      {...props}
    />
  );
}

export function Select({ error = false, className = "", children, ref, ...props }: any) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={error || undefined}
        className={cx(CONTROL_BASE, controlBorder(error), "h-10 appearance-none px-3 ps-9 text-sm", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[var(--va-text-muted)]"
        aria-hidden="true"
      />
    </div>
  );
}

export function Switch({ checked = false, onChange, label, disabled = false, id, className = "" }: any) {
  return (
    <label htmlFor={id} className={cx("inline-flex cursor-pointer items-center gap-2.5", disabled && "cursor-not-allowed opacity-55", className)}>
      {/* Wrapper expands the tap target to ≥44px vertically (WCAG 2.5.5) without changing the visual footprint */}
      <span className="relative inline-flex items-center justify-center min-h-[44px] min-w-[44px]">
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange?.(!checked)}
          className={cx(
            "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45",
            checked ? "border-transparent bg-emerald-500" : "border-[var(--va-border-strong)] bg-[var(--va-surface-2)]"
          )}
        >
          {/* Use logical CSS inset-inline-start/end so thumb direction follows RTL automatically */}
          <span
            className={cx(
              "absolute top-0.5 rounded-full bg-white shadow transition-all",
              checked ? "end-0.5" : "start-0.5"
            )}
            style={{ height: "1.125rem", width: "1.125rem" }}
          />
        </button>
      </span>
      {label && <span className="text-sm text-[var(--va-text-2)]">{label}</span>}
    </label>
  );
}

/* ───────────────────────────── Tabs (compound) ───────────────────────────── */

const TabsContext = React.createContext<any>(null);

export function Tabs({ value, defaultValue, onValueChange, children, className = "" }: any) {
  const [internal, setInternal] = React.useState(defaultValue);
  const active = value !== undefined ? value : internal;
  const setActive = React.useCallback(
    (next: any) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [value, onValueChange]
  );
  const ctx = React.useMemo(() => ({ active, setActive }), [active, setActive]);
  return (
    <TabsContext.Provider value={ctx}>
      <div dir="rtl" className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs.* must be used inside <Tabs>");
  return ctx;
}

Tabs.List = function TabsList({ children, ariaLabel = "تبويبات", className = "" }: any) {
  const onKeyDown = (e: any) => {
    const triggers = Array.from(e.currentTarget.querySelectorAll('[role="tab"]:not([disabled])'));
    const idx = triggers.indexOf(document.activeElement);
    if (idx === -1) return;
    let next = idx;
    if (e.key === "ArrowLeft") next = (idx + 1) % triggers.length;
    else if (e.key === "ArrowRight") next = (idx - 1 + triggers.length) % triggers.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = triggers.length - 1;
    else return;
    e.preventDefault();
    (triggers[next] as any)?.focus();
    (triggers[next] as any)?.click();
  };
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cx(
        "inline-flex gap-1 rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-1",
        className
      )}
    >
      {children}
    </div>
  );
};

Tabs.Trigger = function TabsTrigger({ value, children, disabled = false, className = "" }: any) {
  const { active, setActive } = useTabs();
  const selected = active === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => setActive(value)}
      className={cx(
        "rounded-[var(--va-radius-md)] px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45",
        selected
          ? "bg-emerald-500/15 text-emerald-300"
          : "text-[var(--va-text-muted)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]",
        className
      )}
    >
      {children}
    </button>
  );
};

Tabs.Panel = function TabsPanel({ value, children, className = "" }: any) {
  const { active } = useTabs();
  if (active !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
};

/* ───────────────────────────── Dialog ───────────────────────────── */

const DIALOG_SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

function useFocusTrap(open: any, containerRef: any, onClose: any) {
  React.useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const node = containerRef.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
        ) || []
      );
    const first = focusables()[0];
    if (first) (first as any).focus();
    else node?.focus?.();

    const onKeyDown = (e: any) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0] as any;
      const lastEl = items[items.length - 1] as any;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      (previouslyFocused as any)?.focus?.();
    };
  }, [open, containerRef, onClose]);
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer = null,
  size = "md",
  closeOnBackdrop = true,
  className = "",
}: any) {
  const containerRef = React.useRef(null);
  const reduced = useReducedMotion();
  useFocusTrap(open, containerRef, onClose);
  if (typeof document === "undefined") return null;

  const titleId = title ? "va-dialog-title" : undefined;
  const descId = description ? "va-dialog-desc" : undefined;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--va-z-modal)] flex items-center justify-center p-4"
          {...(reduced ? { initial: false } : overlayMotion)}
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            dir="rtl"
            tabIndex={-1}
            {...(reduced ? { initial: false } : dialogMotion)}
            className={cx(
              "relative w-full overflow-hidden rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] text-[var(--va-text)] shadow-[var(--va-elev-popover)]",
              (DIALOG_SIZES as any)[size] || DIALOG_SIZES.md,
              className
            )}
          >
            {(title || onClose) && (
              <div className="flex items-start justify-between gap-3 border-b border-[var(--va-border-soft)] px-5 py-4">
                <div className="min-w-0">
                  {title && <h2 id={titleId} className="text-base font-medium">{title}</h2>}
                  {description && (
                    <p id={descId} className="mt-1 text-sm text-[var(--va-text-muted)]">{description}</p>
                  )}
                </div>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="إغلاق"
                    className="shrink-0 rounded-[var(--va-radius-md)] p-1.5 text-[var(--va-text-muted)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]"
                  >
                    <X style={{ height: "1.125rem", width: "1.125rem" }} />
                  </button>
                )}
              </div>
            )}
            <div className="px-5 py-4">{children}</div>
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--va-border-soft)] bg-[var(--va-surface)] px-5 py-3.5">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export { Check as DialogCheckIcon };

/* ───────────────────────────── ToastV2 ───────────────────────────── */

/**
 * ToastV2 — accessible, portal-rendered toast notification.
 * Auto-dismisses after `duration` ms. RTL-safe positioning via inset-inline-end.
 *
 * @param {{ message: string, type?: "success"|"error"|"warning"|"info", onDismiss?: () => void, duration?: number }} props
 */

const TOAST_TYPE_STYLES = {
  success: "border-[var(--va-status-success)] bg-[color-mix(in_oklab,var(--va-status-success)_12%,var(--va-elevated))] text-[var(--va-status-success)]",
  error:   "border-[var(--va-status-danger)]  bg-[color-mix(in_oklab,var(--va-status-danger)_12%,var(--va-elevated))]  text-[var(--va-status-danger)]",
  warning: "border-[var(--va-status-warning)] bg-[color-mix(in_oklab,var(--va-status-warning)_12%,var(--va-elevated))] text-[var(--va-status-warning)]",
  info:    "border-[var(--va-status-info)]    bg-[color-mix(in_oklab,var(--va-status-info)_12%,var(--va-elevated))]    text-[var(--va-status-info)]",
};

export function ToastV2({ message, type = "info", onDismiss, duration = 4000 }: any) {
  React.useEffect(() => {
    if (!onDismiss) return undefined;
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [onDismiss, duration]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="alert"
      aria-live="assertive"
      dir="rtl"
      style={{
        position: "fixed",
        bottom: "var(--va-space-6)",
        insetInlineEnd: "50%",
        transform: "translateX(50%)",
        zIndex: "var(--va-z-toast)",
        minWidth: "18rem",
        maxWidth: "calc(100vw - var(--va-space-8))",
      }}
      className={cx(
        "flex items-start gap-3 rounded-[var(--va-radius-lg)] border px-4 py-3 text-sm font-medium shadow-[var(--va-elev-popover)]",
        (TOAST_TYPE_STYLES as any)[type] || TOAST_TYPE_STYLES.info
      )}
    >
      <span className="flex-1 text-[var(--va-text)]">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="إغلاق"
          className="shrink-0 rounded-[var(--va-radius-sm)] p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          ×
        </button>
      )}
    </div>,
    document.body
  );
}

/* ───────────────────────────── TooltipV2 ───────────────────────────── */

/**
 * TooltipV2 — lightweight CSS-position tooltip, no external lib.
 * Shows on hover and focus (keyboard accessible). RTL-safe: start/end sides
 * use inset-inline-start / inset-inline-end logical properties.
 *
 * @param {{ content: string|React.ReactNode, children: React.ReactNode, placement?: "top"|"bottom"|"start"|"end" }} props
 */

const TOOLTIP_PLACEMENT = {
  top:    { bottom: "calc(100% + var(--va-space-2))", insetInlineStart: "50%", transform: "translateX(-50%)" },
  bottom: { top:    "calc(100% + var(--va-space-2))", insetInlineStart: "50%", transform: "translateX(-50%)" },
  start:  { top: "50%", insetInlineEnd: "calc(100% + var(--va-space-2))", transform: "translateY(-50%)" },
  end:    { top: "50%", insetInlineStart: "calc(100% + var(--va-space-2))", transform: "translateY(-50%)" },
};

export function TooltipV2({ content, children, placement = "top" }: any) {
  const [visible, setVisible] = React.useState(false);
  const tooltipId = React.useId();

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  const positionStyles = (TOOLTIP_PLACEMENT as any)[placement] || TOOLTIP_PLACEMENT.top;

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {React.cloneElement(React.Children.only(children), {
        "aria-describedby": visible ? tooltipId : undefined,
      })}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: "var(--va-z-tooltip)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            ...positionStyles,
          }}
          className="rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] px-2 py-1 text-xs text-[var(--va-text)] shadow-[var(--va-elev-popover)]"
        >
          {content}
        </span>
      )}
    </span>
  );
}
