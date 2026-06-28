import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export interface DialogV2Props
  extends Omit<React.DialogHTMLAttributes<HTMLDialogElement>, "onClose" | "title"> {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  closeOnBackdrop?: boolean;
  footer?: React.ReactNode;
}

type DialogSlotProps = React.HTMLAttributes<HTMLDivElement>;

function DialogV2Base({
  open,
  onClose,
  title,
  description,
  closeOnBackdrop = true,
  className = "",
  children,
  footer = null,
  ...rest
}: DialogV2Props) {
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const titleId = title ? "va2-dialog-title" : undefined;
  const descId = description ? "va2-dialog-desc" : undefined;

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose?.();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
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
      {...rest}
    >
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

      <div className="flex-1 px-5 py-4">{children}</div>

      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--va-border-soft)] bg-[var(--va-surface)] px-5 py-3.5">
          {footer}
        </div>
      )}
    </dialog>
  );
}

type DialogCompound = React.FC<DialogV2Props> & {
  Body: React.FC<DialogSlotProps>;
  Footer: React.FC<DialogSlotProps>;
};

function DialogV2Body({ className = "", children, ...rest }: DialogSlotProps) {
  return (
    <div className={cx("text-sm text-[var(--va-text-2)]", className)} {...rest}>
      {children}
    </div>
  );
}

function DialogV2Footer({ className = "", children, ...rest }: DialogSlotProps) {
  return (
    <div className={cx("flex items-center justify-end gap-2", className)} {...rest}>
      {children}
    </div>
  );
}

export const DialogV2 = Object.assign(DialogV2Base, {
  Body: DialogV2Body,
  Footer: DialogV2Footer,
}) as DialogCompound;

DialogV2.displayName = "DialogV2";
DialogV2.Body.displayName = "DialogV2.Body";
DialogV2.Footer.displayName = "DialogV2.Footer";
