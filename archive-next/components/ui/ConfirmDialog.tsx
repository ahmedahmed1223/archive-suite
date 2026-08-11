"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export type ConfirmOptions = {
  /** Describes the impact of the action shown in the dialog. */
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions use the danger treatment while initial focus remains on the safe cancel action. */
  destructive?: boolean;
};

export type PromptOptions = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
};

export type AlertOptions = {
  message: string;
  title?: string;
  closeLabel?: string;
};

type PendingDialog =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void }
  | { kind: "alert"; options: AlertOptions; resolve: () => void };

export type ConfirmDialogApi = {
  /** Replaces window.confirm and resolves true on confirmation or false on cancel and dismiss. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Replaces window.prompt and resolves the entered value or null on cancel and dismiss. */
  prompt: (options: PromptOptions) => Promise<string | null>;
  /** Replaces window.alert and resolves when the alert closes. */
  alert: (options: AlertOptions) => Promise<void>;
};

const ConfirmDialogContext = createContext<ConfirmDialogApi | null>(null);

export function useConfirmDialog(): ConfirmDialogApi {
  const api = useContext(ConfirmDialogContext);
  if (!api) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }
  return api;
}

export function ConfirmDialogProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useLocale();
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const safeActionRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ kind: "confirm", options, resolve })),
    []
  );
  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => setPending({ kind: "prompt", options, resolve })),
    []
  );
  const alert = useCallback(
    (options: AlertOptions) => new Promise<void>((resolve) => setPending({ kind: "alert", options, resolve })),
    []
  );

  const api = useMemo<ConfirmDialogApi>(() => ({ confirm, prompt, alert }), [confirm, prompt, alert]);

  const dismiss = useCallback(() => {
    if (!pending) return;
    if (pending.kind === "confirm") pending.resolve(false);
    else if (pending.kind === "prompt") pending.resolve(null);
    else pending.resolve();
    setPending(null);
  }, [pending]);

  const handleConfirm = useCallback(() => {
    if (!pending || pending.kind !== "confirm") return;
    pending.resolve(true);
    setPending(null);
  }, [pending]);

  const handlePromptSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!pending || pending.kind !== "prompt") return;
      pending.resolve(inputRef.current?.value ?? "");
      setPending(null);
    },
    [pending]
  );

  const handleAlertClose = useCallback(() => {
    if (!pending || pending.kind !== "alert") return;
    pending.resolve();
    setPending(null);
  }, [pending]);

  const defaultTitles = { confirm: t.shared.feedback.confirmActionTitle, prompt: t.shared.feedback.promptValueTitle, alert: t.shared.feedback.alertTitle } as const;
  const title = pending ? (pending.options.title ?? defaultTitles[pending.kind]) : "";

  return (
    <ConfirmDialogContext.Provider value={api}>
      {children}
      {pending ? (
        <Dialog open onOpenChange={(open) => !open && dismiss()}>
          <DialogContent
            className="system-control-confirmation"
            description={pending.options.message}
            title={title}
            onOpenAutoFocus={(event) => {
              // Initial focus goes to the prompt input or the safe action in confirmation and alert dialogs.
              event.preventDefault();
              if (pending.kind === "prompt") inputRef.current?.focus();
              else safeActionRef.current?.focus();
            }}
          >
            {pending.kind === "confirm" ? (
              <div className="system-control-confirmation__body">
                <div className="system-control-confirmation__actions">
                  <Button ref={safeActionRef} type="button" variant="secondary" onClick={dismiss}>
                    {pending.options.cancelLabel ?? t.shared.actions.cancel}
                  </Button>
                  <Button
                    type="button"
                    variant={pending.options.destructive ? "danger" : "primary"}
                    onClick={handleConfirm}
                  >
                    {pending.options.confirmLabel ?? t.shared.actions.confirm}
                  </Button>
                </div>
              </div>
            ) : null}
            {pending.kind === "prompt" ? (
              <form className="system-control-confirmation__body" onSubmit={handlePromptSubmit}>
                <input
                  ref={inputRef}
                  aria-label={pending.options.message}
                  defaultValue={pending.options.defaultValue ?? ""}
                  dir="auto"
                  name="value"
                  type="text"
                />
                <div className="system-control-confirmation__actions">
                  <Button type="button" variant="secondary" onClick={dismiss}>
                    {pending.options.cancelLabel ?? t.shared.actions.cancel}
                  </Button>
                  <Button type="submit" variant="primary">
                    {pending.options.confirmLabel ?? t.shared.actions.accept}
                  </Button>
                </div>
              </form>
            ) : null}
            {pending.kind === "alert" ? (
              <div className="system-control-confirmation__body">
                <div className="system-control-confirmation__actions">
                  <Button ref={safeActionRef} type="button" variant="primary" onClick={handleAlertClose}>
                    {pending.options.closeLabel ?? t.shared.actions.close}
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </ConfirmDialogContext.Provider>
  );
}
