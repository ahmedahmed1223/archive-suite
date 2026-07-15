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

export type ConfirmOptions = {
  /** وصف أثر الإجراء المعروض داخل الحوار. */
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** الإجراءات الإتلافية تُبرز زر التأكيد بلون الخطر، والتركيز يبقى على زر الإلغاء الآمن. */
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
  /** بديل window.confirm — يُرجع true عند التأكيد و false عند الإلغاء أو الإغلاق. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** بديل window.prompt — يُرجع النص المدخل أو null عند الإلغاء أو الإغلاق. */
  prompt: (options: PromptOptions) => Promise<string | null>;
  /** بديل window.alert — يُحل الوعد عند إغلاق التنبيه. */
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

const DEFAULT_TITLES = {
  confirm: "تأكيد الإجراء",
  prompt: "إدخال قيمة",
  alert: "تنبيه"
} as const;

export function ConfirmDialogProvider({ children }: Readonly<{ children: ReactNode }>) {
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

  const title = pending ? (pending.options.title ?? DEFAULT_TITLES[pending.kind]) : "";

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
              // التركيز الابتدائي: حقل الإدخال في حوار الإدخال، وزر الإجراء الآمن في التأكيد والتنبيه.
              event.preventDefault();
              if (pending.kind === "prompt") inputRef.current?.focus();
              else safeActionRef.current?.focus();
            }}
          >
            {pending.kind === "confirm" ? (
              <div className="system-control-confirmation__body">
                <div className="system-control-confirmation__actions">
                  <Button ref={safeActionRef} type="button" variant="secondary" onClick={dismiss}>
                    {pending.options.cancelLabel ?? "إلغاء"}
                  </Button>
                  <Button
                    type="button"
                    variant={pending.options.destructive ? "danger" : "primary"}
                    onClick={handleConfirm}
                  >
                    {pending.options.confirmLabel ?? "تأكيد"}
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
                    {pending.options.cancelLabel ?? "إلغاء"}
                  </Button>
                  <Button type="submit" variant="primary">
                    {pending.options.confirmLabel ?? "موافق"}
                  </Button>
                </div>
              </form>
            ) : null}
            {pending.kind === "alert" ? (
              <div className="system-control-confirmation__body">
                <div className="system-control-confirmation__actions">
                  <Button ref={safeActionRef} type="button" variant="primary" onClick={handleAlertClose}>
                    {pending.options.closeLabel ?? "حسناً"}
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
