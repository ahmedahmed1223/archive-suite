import { createContext, useContext, useState, useEffect, useCallback, useRef, useId } from "react";
import { createPortal } from "react-dom";

// ─── DialogManager ────────────────────────────────────────────────────────────
//
// A context-based dialog manager that handles:
//   - z-index stacking (each dialog gets z-index 1000 + stackIndex * 10)
//   - Body scroll lock (prevents background scroll when any dialog is open)
//   - Escape key closes only the topmost dialog (capture phase, stops propagation)
//   - Focus trap within each dialog (Tab / Shift+Tab cycle; focus restored on close)
//
// Usage:
//   // 1. Wrap your app with <DialogProvider> (done in RuntimeShellApp.js)
//
//   // 2. In any component:
//   const { open, close } = useDialog();
//   open("confirm-delete", ConfirmDeleteDialog, { itemName: "...", onConfirm: () => {} });
//
//   // 3. Inside ConfirmDeleteDialog:
//   function ConfirmDeleteDialog({ itemName, onConfirm, onClose, isTop }) {
//     return <div>…<button onClick={onClose}>إلغاء</button></div>;
//   }
//
// Note: The existing showConfirm / appAlert / appConfirm / appPrompt imperative
// APIs in ConfirmDialog.js continue to work unchanged — they create their own
// React roots. DialogProvider wraps them rather than replacing them.
// ─────────────────────────────────────────────────────────────────────────────

const DialogContext = createContext<any>(null);

// ─── DialogProvider ───────────────────────────────────────────────────────────

/**
 * DialogProvider — mount once near the root, inside ErrorBoundary.
 * Exposes { open, close, closeTop, stack } via useDialog().
 */
export function DialogProvider({ children }: any) {
  const [stack, setStack] = useState([] as any[]); // [{ id, component, props }]

  const open = useCallback((id: any, component: any, props: any = {}) => {
    setStack((prev: any) => {
      if (prev.some((d: any) => d.id === id)) return prev; // prevent duplicates
      return [...prev, { id, component, props }];
    });
  }, []);

  const close = useCallback((id: any) => {
    setStack((prev: any) => prev.filter((d: any) => d.id !== id));
  }, []);

  const closeTop = useCallback(() => {
    setStack((prev: any) => prev.slice(0, -1));
  }, []);

  // Body scroll lock — applied whenever any dialog is open.
  // Uses the position:fixed technique so iOS Safari doesn't scroll the body.
  const anyOpen = stack.length > 0;
  useEffect(() => {
    if (!anyOpen) return;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [anyOpen]);

  // Global Escape handler — closes the topmost dialog only.
  // Uses capture phase so it fires before any inner keydown listeners.
  useEffect(() => {
    if (stack.length === 0) return;
    const onKeyDown = (e: any) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeTop();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [stack.length, closeTop]);

  const contextValue = { open, close, closeTop, stack };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      {typeof document !== "undefined" &&
        stack.map((dialog: any, idx: any) => {
          const zIndex = 1000 + idx * 10;
          const isTop = idx === stack.length - 1;
          const Component = dialog.component;
          return createPortal(
            <DialogBackdrop
              key={dialog.id}
              zIndex={zIndex}
              isTop={isTop}
              onBackdropClick={isTop ? closeTop : undefined}
            >
              <FocusTrap>
                <Component
                  {...dialog.props}
                  onClose={() => close(dialog.id)}
                  isTop={isTop}
                />
              </FocusTrap>
            </DialogBackdrop>,
            document.body
          );
        })}
    </DialogContext.Provider>
  );
}

// ─── DialogBackdrop ───────────────────────────────────────────────────────────

function DialogBackdrop({ children, zIndex, isTop, onBackdropClick }: any) {
  return (
    <div
      style={{ zIndex }}
      className={[
        "fixed inset-0 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity",
        isTop ? "bg-black/60" : "bg-black/30",
      ].join(" ")}
      onClick={(e: any) => {
        if (e.target === e.currentTarget && onBackdropClick) onBackdropClick();
      }}
      role="none"
    >
      {children}
    </div>
  );
}

// ─── FocusTrap ────────────────────────────────────────────────────────────────
//
// Traps Tab/Shift+Tab focus within its child element.
// Works for RTL layouts — focus order follows DOM order (which respects
// the visual reading order in RTL via text-right / dir="rtl").
// Restores focus to the previously active element on unmount.

function FocusTrap({ children }: any) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const FOCUSABLE =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusable = () => Array.from((el as any).querySelectorAll(FOCUSABLE));

    // Save the element that had focus before this dialog opened
    const prevFocus = document.activeElement;

    // Auto-focus the first focusable element
    const focusable = getFocusable();
    if (focusable.length > 0) {
      // Use rAF so the DOM is fully painted before focusing
      const rafId = requestAnimationFrame(() => (focusable[0] as any)?.focus());
      // Store it so we can cancel if the effect cleans up synchronously
      (el as any).__rafId = rafId;
    }

    const onKeyDown = (e: any) => {
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !(el as any).contains(document.activeElement)) {
          e.preventDefault();
          (last as any)?.focus();
        }
      } else {
        if (document.activeElement === last || !(el as any).contains(document.activeElement)) {
          e.preventDefault();
          (first as any)?.focus();
        }
      }
    };

    (el as any).addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame((el as any).__rafId);
      (el as any).removeEventListener("keydown", onKeyDown);
      // Restore focus to whatever was focused before this dialog opened
      if (prevFocus && typeof (prevFocus as any).focus === "function") {
        (prevFocus as any).focus();
      }
    };
  }, []);

  return <div ref={ref} role="dialog" aria-modal="true">{children}</div>;
}

// ─── useDialog ────────────────────────────────────────────────────────────────

/**
 * Access the dialog manager from any component inside DialogProvider.
 *
 * @returns {{ open, close, closeTop, stack }}
 *   open(id, Component, props?)  — push a dialog onto the stack
 *   close(id)                    — remove a specific dialog by id
 *   closeTop()                   — remove the topmost dialog
 *   stack                        — read-only array of open dialogs
 */
export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error(
      "[DialogManager] useDialog must be used within a <DialogProvider>. " +
        "Make sure DialogProvider wraps your app in RuntimeShellApp.js."
    );
  }
  return ctx;
}
