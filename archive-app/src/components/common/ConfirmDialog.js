import * as React from "react";
import { createRoot } from "react-dom/client";
import { jsx, jsxs } from "react/jsx-runtime";

// ─── Tiered Destructive Confirm Dialog ────────────────────────────────────────
//
// Level 1 — Standard delete (amber): simple confirmation.
// Level 2 — Destructive delete (orange): user must type confirmPhrase.
// Level 3 — Critical/irreversible (red): 5-second countdown + type "حذف نهائي".
//
// API:
//   showConfirm({ level, title, message, confirmPhrase?, onConfirm })
//
// Backward-compat: appConfirm / appAlert / appPrompt continue to work unchanged.

const LEVEL_STYLES = {
  1: {
    border: "border-amber-500/35",
    header: "text-amber-100",
    icon: "⚠",
    iconColor: "text-amber-400",
    iconBg: "border-amber-500/30 bg-amber-500/10",
    confirm: "border-amber-500/40 bg-amber-600 hover:bg-amber-500 text-white",
    countdown: null,
  },
  2: {
    border: "border-orange-500/35",
    header: "text-orange-100",
    icon: "⚠",
    iconColor: "text-orange-400",
    iconBg: "border-orange-500/30 bg-orange-500/10",
    confirm: "border-orange-500/40 bg-orange-600 hover:bg-orange-500 text-white",
    countdown: null,
  },
  3: {
    border: "border-red-500/35",
    header: "text-red-100",
    icon: "⊗",
    iconColor: "text-red-400",
    iconBg: "border-red-500/30 bg-red-500/10",
    confirm: "border-red-500/40 bg-red-600 hover:bg-red-500 text-white",
    countdown: 5,
  },
};

const LEVEL_3_PHRASE = "حذف نهائي";

function TieredDialogModal({ config, onResolve }) {
  const { level = 1, title, message, confirmPhrase } = config;
  const styles = LEVEL_STYLES[level] || LEVEL_STYLES[1];

  // Level 2: typed phrase to unlock confirm button
  const [typed, setTyped] = React.useState("");

  // Level 3: countdown timer
  const targetPhrase = level === 3 ? LEVEL_3_PHRASE : confirmPhrase;
  const [secondsLeft, setSecondsLeft] = React.useState(
    styles.countdown !== null ? styles.countdown : 0
  );
  const inputRef = React.useRef(null);
  const confirmRef = React.useRef(null);

  React.useEffect(() => {
    if (styles.countdown === null) return undefined;
    if (secondsLeft <= 0) return undefined;
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft, styles.countdown]);

  const countdownDone = styles.countdown === null || secondsLeft <= 0;

  // Level 2 and 3: require typed phrase
  const phraseOk =
    level === 1
      ? true
      : typed.trim() === (targetPhrase || "").trim();

  const confirmEnabled = countdownDone && phraseOk;

  React.useEffect(() => {
    const target = level >= 2 ? inputRef.current : confirmRef.current;
    if (target) window.requestAnimationFrame(() => target.focus());
  }, [level]);

  React.useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") onResolve(false);
      if (event.key === "Enter" && confirmEnabled) onResolve(true);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  // DaisyUI `modal modal-open` shell (§1881 Phase 8) — keeps custom backdrop tint,
  // z-index, RTL, and backdrop-click-to-cancel behavior intact.
  return jsx("div", {
    className: "modal modal-open va-dialog-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md",
    style: { background: "rgba(3, 7, 18, 0.72)" },
    dir: "rtl",
    onClick: (event) => { if (event.target === event.currentTarget) onResolve(false); },
    children: jsxs("section", {
      role: "alertdialog",
      "aria-modal": "true",
      "aria-labelledby": "va-tiered-dialog-title",
      className: `modal-box va-card va-dialog-panel w-full max-w-md rounded-2xl border ${styles.border} bg-gray-900/95 p-5 text-right text-white shadow-2xl`,
      onClick: (event) => event.stopPropagation(),
      children: [
        // Header row
        jsxs("div", {
          className: "flex items-start gap-3",
          children: [
            jsx("span", {
              className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg ${styles.iconColor} ${styles.iconBg}`,
              "aria-hidden": "true",
              children: styles.icon
            }),
            jsxs("div", {
              className: "min-w-0 flex-1",
              children: [
                jsx("h2", {
                  id: "va-tiered-dialog-title",
                  className: `text-base font-bold ${styles.header}`,
                  children: title || "تأكيد الإجراء"
                }),
                jsx("p", {
                  className: "mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-300",
                  dir: "auto",
                  style: { unicodeBidi: "plaintext", overflowWrap: "anywhere" },
                  children: message
                })
              ]
            })
          ]
        }),

        // Level 2: type item name
        level === 2 && targetPhrase && jsxs("div", {
          className: "mt-4",
          children: [
            jsxs("label", {
              htmlFor: "va-tiered-phrase-input",
              className: "block text-xs text-gray-400 mb-1.5",
              children: ["اكتب «", jsx("span", { className: "font-semibold text-orange-300", children: targetPhrase }), "» للتأكيد"]
            }),
            jsx("input", {
              id: "va-tiered-phrase-input",
              ref: inputRef,
              type: "text",
              value: typed,
              onChange: (event) => setTyped(event.target.value),
              dir: "auto",
              autoComplete: "off",
              spellCheck: "false",
              className: "mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-gray-950/45 px-3 text-sm text-white outline-none focus:border-orange-500/50",
              placeholder: targetPhrase
            })
          ]
        }),

        // Level 3: type "حذف نهائي" and countdown
        level === 3 && jsxs("div", {
          className: "mt-4",
          children: [
            // Countdown warning badge — DaisyUI `alert alert-error` (§1881 Phase 8)
            !countdownDone && jsxs("div", {
              role: "alert",
              className: "alert alert-error mb-3 flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200",
              children: [
                jsx("span", { className: "font-bold tabular-nums text-red-300", children: secondsLeft }),
                jsx("span", { children: "ثوانٍ قبل تفعيل زر الحذف" })
              ]
            }),
            jsxs("label", {
              htmlFor: "va-tiered-phrase-input",
              className: "block text-xs text-gray-400 mb-1.5",
              children: ["اكتب «", jsx("span", { className: "font-semibold text-red-300", children: LEVEL_3_PHRASE }), "» للتأكيد"]
            }),
            jsx("input", {
              id: "va-tiered-phrase-input",
              ref: inputRef,
              type: "text",
              value: typed,
              onChange: (event) => setTyped(event.target.value),
              dir: "auto",
              autoComplete: "off",
              spellCheck: "false",
              className: "mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-gray-950/45 px-3 text-sm text-white outline-none focus:border-red-500/50",
              placeholder: LEVEL_3_PHRASE
            })
          ]
        }),

        // Action buttons — DaisyUI `modal-action` (§1881 Phase 8); keep justify-start for RTL
        jsxs("div", {
          className: "modal-action mt-5 flex flex-wrap justify-start gap-2",
          children: [
            jsx("button", {
              type: "button",
              onClick: () => onResolve(false),
              className: "btn btn-ghost",
              children: "إلغاء"
            }),
            jsx("button", {
              ref: confirmRef,
              type: "button",
              disabled: !confirmEnabled,
              onClick: () => { if (confirmEnabled) onResolve(true); },
              className: `min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold transition-opacity ${styles.confirm} disabled:cursor-not-allowed disabled:opacity-40`,
              children: level === 3 && !countdownDone
                ? `انتظر (${secondsLeft}ث)`
                : level === 1 ? "تأكيد" : "حذف نهائياً"
            })
          ]
        })
      ]
    })
  });
}

/**
 * Show a tiered destructive-action confirmation dialog.
 *
 * @param {object} config
 * @param {1|2|3} config.level - Severity tier
 * @param {string} config.title - Dialog title
 * @param {string} config.message - Body text
 * @param {string} [config.confirmPhrase] - Phrase user must type (Level 2 only)
 * @param {Function} [config.onConfirm] - Called if confirmed (optional; also returns Promise<boolean>)
 * @returns {Promise<boolean>}
 */
export function showConfirm(config) {
  if (typeof document === "undefined" || typeof window === "undefined" || !document.body) {
    console.warn("[showConfirm] called in non-browser context");
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "va-dialog-host";
    document.body.append(host);
    const root = createRoot(host);

    const cleanup = (result) => {
      root.unmount();
      host.remove();
      if (result && typeof config.onConfirm === "function") {
        config.onConfirm();
      }
      resolve(result);
    };

    root.render(jsx(TieredDialogModal, { config, onResolve: cleanup }));
  });
}
// ─── End Tiered Destructive Confirm Dialog ────────────────────────────────────

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

  // DaisyUI `modal modal-open` shell (§1881 Phase 8) — keeps custom backdrop tint,
  // z-index, RTL, and backdrop-click-to-cancel behavior intact.
  return jsx("div", {
    className: "modal modal-open va-dialog-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md",
    style: { background: "rgba(3, 7, 18, 0.72)" },
    dir: "rtl",
    onClick: (event) => {
      if (event.target === event.currentTarget) handleCancel();
    },
    children: jsxs("section", {
      role: mode === "alert" ? "alertdialog" : "dialog",
      "aria-modal": "true",
      "aria-labelledby": "va-dialog-title",
      className: "modal-box va-card va-dialog-panel w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/90 p-5 text-right text-white shadow-2xl",
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
          className: "modal-action mt-5 flex flex-wrap justify-start gap-2",
          children: [
            mode !== "alert" && jsx("button", {
              type: "button",
              onClick: handleCancel,
              className: "btn btn-ghost",
              children: cancelText
            }),
            jsx("button", {
              ref: confirmRef,
              type: "button",
              onClick: handleConfirm,
              className: isDanger
                ? "min-h-10 rounded-xl border border-red-500/45 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                : "btn btn-primary",
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
