import * as React from "react";
import { createRoot } from "react-dom/client";
import { jsx, jsxs } from "react/jsx-runtime";

function normalizeDialogInput(message, options = {}) {
  const fromObject = typeof message === "object" && message !== null ? message : {};
  const finalOptions = { ...options, ...fromObject };
  return {
    title: finalOptions.title || "تنبيه",
    message: finalOptions.message || finalOptions.description || String(message || ""),
    kind: finalOptions.kind || "info",
    confirmLabel: finalOptions.confirmLabel,
    cancelLabel: finalOptions.cancelLabel,
    defaultValue: finalOptions.defaultValue || ""
  };
}

function fallbackDialog(request, mode) {
  console.warn("[VideoArchiveDialog]", [request.title, request.message].filter(Boolean).join(" | "));
  if (mode === "prompt") return Promise.resolve(null);
  if (mode === "confirm") return Promise.resolve(false);
  return Promise.resolve(true);
}

function DialogModal({ request, mode, onResolve }) {
  const [value, setValue] = React.useState(request.defaultValue || "");
  const inputRef = React.useRef(null);
  const confirmRef = React.useRef(null);

  const close = React.useCallback((result) => {
    onResolve(result);
  }, [onResolve]);

  const handleConfirm = () => {
    if (mode === "prompt") close(value);
    else close(true);
  };

  const handleCancel = () => {
    if (mode === "confirm") close(false);
    else if (mode === "prompt") close(null);
    else close(true);
  };

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") handleCancel();
      else if (event.key === "Enter" && mode !== "alert") handleConfirm();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  React.useEffect(() => {
    const target = mode === "prompt" ? inputRef.current : confirmRef.current;
    if (target) {
      window.requestAnimationFrame(() => target.focus());
    }
  }, [mode]);

  const isDanger = request.kind === "danger";
  const confirmText = request.confirmLabel || (mode === "alert" ? "حسنًا" : "متابعة");
  const cancelText = request.cancelLabel || "إلغاء";

  return jsx("div", {
    className: "va-dialog-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md",
    style: { background: "rgba(3, 7, 18, 0.72)" },
    dir: "rtl",
    onClick: (event) => {
      if (event.target === event.currentTarget) handleCancel();
    },
    children: jsxs("section", {
      role: mode === "alert" ? "alertdialog" : "dialog",
      "aria-modal": "true",
      "aria-labelledby": "va-dialog-title",
      className: "va-card va-dialog-panel w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/90 p-5 text-right text-white shadow-2xl",
      onClick: (event) => event.stopPropagation(),
      children: [
        jsx("h2", {
          id: "va-dialog-title",
          className: "text-base font-bold text-white",
          children: request.title
        }),
        jsx("p", {
          className: "mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-300",
          dir: "auto",
          style: { unicodeBidi: "plaintext", overflowWrap: "anywhere" },
          children: request.message
        }),
        mode === "prompt" && jsx("input", {
          ref: inputRef,
          className: "mt-4 min-h-11 w-full rounded-xl border border-white/10 bg-gray-950/45 px-3 text-sm text-white outline-none focus:border-emerald-500/50",
          dir: "auto",
          value,
          onChange: (event) => setValue(event.target.value)
        }),
        jsxs("div", {
          className: "mt-5 flex flex-wrap justify-start gap-2",
          children: [
            mode !== "alert" && jsx("button", {
              type: "button",
              onClick: handleCancel,
              className: "va-secondary-button min-h-10 rounded-xl border border-white/10 bg-gray-950/55 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5",
              children: cancelText
            }),
            jsx("button", {
              ref: confirmRef,
              type: "button",
              onClick: handleConfirm,
              className: isDanger
                ? "min-h-10 rounded-xl border border-red-500/45 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                : "va-primary-button min-h-10 rounded-xl px-4 py-2 text-sm font-semibold text-white",
              children: confirmText
            })
          ]
        })
      ]
    })
  });
}

function openReactDialog(message, options = {}, mode = "alert") {
  const request = normalizeDialogInput(message, options);
  if (typeof document === "undefined" || typeof window === "undefined" || !document.body) {
    return fallbackDialog(request, mode);
  }

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "va-dialog-host";
    document.body.append(host);
    const root = createRoot(host);

    const cleanup = (result) => {
      root.unmount();
      host.remove();
      resolve(result);
    };

    root.render(jsx(DialogModal, { request, mode, onResolve: cleanup }));
  });
}

export function appAlert(message, options = {}) {
  return openReactDialog(message, { title: "تنبيه", confirmLabel: "حسنًا", ...options }, "alert");
}

export function appConfirm(message, options = {}) {
  return openReactDialog(message, { title: "تأكيد الإجراء", confirmLabel: "متابعة", cancelLabel: "إلغاء", kind: "warning", ...options }, "confirm");
}

export function appPrompt(message, options = {}) {
  const normalizedOptions = typeof options === "string" ? { defaultValue: options } : options;
  return openReactDialog(message, { title: "إدخال مطلوب", confirmLabel: "حفظ", cancelLabel: "إلغاء", ...normalizedOptions }, "prompt");
}
