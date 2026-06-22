/**
 * DialogV2 — v2 modal built on native HTMLDialogElement.
 * Focus trap, ESC-to-close, optional click-outside-to-close, RTL dir.
 * aria-labelledby / aria-describedby wired via titleId / descId props.
 *
 * @param {{ open: boolean, onClose: () => void, title?: string, description?: string, closeOnBackdrop?: boolean, children: React.ReactNode, footer?: React.ReactNode, className?: string }} props
 * @example
 * <DialogV2 open={show} onClose={() => setShow(false)} title="تأكيد الحذف">
 *   <DialogV2.Body>هل أنت متأكد من حذف هذا العنصر؟</DialogV2.Body>
 *   <DialogV2.Footer><ButtonV2 variant="destructive">حذف</ButtonV2></DialogV2.Footer>
 * </DialogV2>
 */
import * as React from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function DialogV2({
  open,
  onClose,
  title,
  description,
  closeOnBackdrop = true,
  className = "",
  children,
  footer = null,
}) {
  const dialogRef = React.useRef(null);
  const titleId = title ? "va2-dialog-title" : undefined;
  const descId = description ? "va2-dialog-desc" : undefined;

  /* Open / close the native <dialog> imperatively */
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  /* Sync native ESC key (fires "cancel" on <dialog>) with onClose */
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleCancel = (e) => {
      e.preventDefault();
      onClose?.();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  /* Click-outside detection via backdrop pseudo-element click */
  const handleClick = React.useCallback(
    (e) => {
      if (!closeOnBackdrop) return;
      const rect = dialogRef.current?.getBoundingClientRect();
      if (!rect) return;
      const outside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (outside) onClose?.();
    },
    [closeOnBackdrop, onClose]
  );

  return (
    <dialog
      ref={dialogRef}
      dir="rtl"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClick={handleClick}
      className={cx(
        "w-full max-w-lg rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)]",
        "bg-[var(--va-elevated,#fff)] text-[var(--va-text)] p-0 shadow-[var(--va-shadow-dialog)]",
        "backdrop:bg-black/55 backdrop:backdrop-blur-sm",
        "open:flex open:flex-col",
        className
      )}
    >
      {/* Header */}
      {(title || onClose) && (
        <div className="flex items-start justify-between gap-3 border-b border-[var(--va-border-soft)] px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-base font-medium text-[var(--va-text)]">
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="mt-1 text-sm text-[var(--va-text-muted)]">
                {description}
              </p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className={cx(
                "shrink-0 rounded-[var(--va-radius-md)] p-1.5",
                "text-[var(--va-text-muted)] transition-colors",
                "hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45"
              )}
            >
              {/* inline X so no lucide import required */}
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Body slot (children) */}
      <div className="flex-1 px-5 py-4">{children}</div>

      {/* Footer */}
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--va-border-soft)] bg-[var(--va-surface)] px-5 py-3.5">
          {footer}
        </div>
      )}
    </dialog>
  );
}

DialogV2.displayName = "DialogV2";

/** Convenience slot — renders inside the body area with semantic wrapper */
DialogV2.Body = function DialogV2Body({ className = "", children, ...rest }) {
  return (
    <div className={cx("text-sm text-[var(--va-text-2)]", className)} {...rest}>
      {children}
    </div>
  );
};
DialogV2.Body.displayName = "DialogV2.Body";

/** Convenience slot — renders a footer row when passed as the footer prop */
DialogV2.Footer = function DialogV2Footer({ className = "", children, ...rest }) {
  return (
    <div className={cx("flex items-center justify-end gap-2", className)} {...rest}>
      {children}
    </div>
  );
};
DialogV2.Footer.displayName = "DialogV2.Footer";
