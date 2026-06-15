import * as React from "react";
import { getAiProvider } from "@archive/core";

// useAiAssist — thin React wrapper over the registered AiProvider port.
//
// Reads the provider from @archive/core (cloud adapter when a cloud backend is
// active, the local stub otherwise). `available` mirrors provider.isAvailable()
// so callers can hide the AI affordances in offline/local mode. Each action
// tracks a `busy` key (the method name) and surfaces failures via showToast,
// returning the parsed result or null so the UI stays simple.

function safeProvider() {
  try {
    return getAiProvider();
  } catch {
    return null;
  }
}

export function useAiAssist({ showToast } = {}) {
  const provider = React.useMemo(() => safeProvider(), []);
  const available = Boolean(provider && typeof provider.isAvailable === "function" && provider.isAvailable());
  const [busy, setBusy] = React.useState("");

  const run = React.useCallback(async (method, call) => {
    if (!provider || !available) {
      showToast?.("الذكاء الاصطناعي غير مُتاح في الوضع الحالي.", "warning");
      return null;
    }
    setBusy(method);
    try {
      return await call(provider);
    } catch (error) {
      showToast?.(error?.message || "تعذّر تنفيذ إجراء الذكاء.", "error");
      return null;
    } finally {
      setBusy("");
    }
  }, [provider, available, showToast]);

  return {
    available,
    busy,
    isBusy: Boolean(busy),
    summarize: (text) => run("summarize", (p) => p.summarize({ text })),
    suggestTags: (payload) => run("suggestTags", (p) => p.suggestTags(payload)),
    proofread: (text) => run("proofread", (p) => p.proofread({ text })),
    chat: ({ context, query, history } = {}) =>
      run("chat", (p) => p.chat({ context, query, history }))
  };
}
