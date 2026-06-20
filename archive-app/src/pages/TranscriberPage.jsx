import { useAppStore } from "../stores/index.js";
import { getAiProvider } from "@archive/core";
import {
  Archive,
  Check,
  Cloud,
  Copy,
  FileAudio,
  Loader2,
  MonitorSmartphone,
  Sparkles,
  Wand2
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { PageHero, UXStateBlock } from "../components/ui/V1Primitives.jsx";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { reportError } from "../utils/errorReporting.js";
import { formatFileSize } from "../utils/formatting.js";
import { createLocalXenovaAiProvider } from "../storage/adapters/ai-local-xenova/index.js";
import {
  availableTranscribeModes,
  resolveTranscribeProvider,
  secondsToClock,
  transcriptToText
} from "../features/media/viewModel.js";

function ModeButton({ active, onClick, icon, label, hint }) {
  return jsxs("button", {
    type: "button",
    onClick,
    "aria-pressed": active,
    className: `flex-1 rounded-xl border p-3 text-right transition-colors ${active ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-[var(--va-border-soft)] bg-[var(--va-surface)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]"}`,
    children: [
      jsxs("span", { className: "flex items-center gap-2 text-sm font-semibold", children: [icon, label] }),
      jsx("span", { className: "mt-1 block text-xs text-[var(--va-text-muted)]", children: hint })
    ]
  });
}

export function TranscriberPage() {
  const { showToast, showNotification, addVideoItem } = useAppStore();
  const cloudProvider = React.useMemo(() => { try { return getAiProvider(); } catch { return null; } }, []);
  const hasLocal = typeof window !== "undefined";
  const modes = React.useMemo(() => availableTranscribeModes({ cloudProvider, hasLocal }), [cloudProvider, hasLocal]);

  const [mode, setMode] = React.useState(() => modes[0] || "local");
  const [file, setFile] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [savedItemId, setSavedItemId] = React.useState(null);
  const transcribeAction = useAsyncAction({ label: "التفريغ الصوتي" });
  const busy = transcribeAction.busy;
  const fileInputId = React.useId();

  const saveToArchive = async () => {
    if (!result || !file) return;
    const text = transcriptToText(result || {}, { withTimecodes: false });
    const title = file.name.replace(/\.[^.]+$/, "");
    const itemType = file.type.startsWith("video/") ? "video" : "audio";
    try {
      const saved = await addVideoItem?.({ title, notes: text, type: itemType, tags: [] });
      if (saved?.id) {
        setSavedItemId(saved.id);
        showToast?.("تم الحفظ كعنصر أرشيف", "success");
      }
    } catch (err) {
      reportError(showNotification, err, { context: "حفظ التفريغ كعنصر أرشيف" });
    }
  };

  const run = async () => {
    if (!file) { showToast?.("اختر ملف صوت أو فيديو أولاً.", "warning"); return; }
    setSavedItemId(null);
    return transcribeAction.run(async () => {
      setResult(null);
      try {
        const { provider } = resolveTranscribeProvider({
          mode,
          cloudProvider,
          localFactory: () => createLocalXenovaAiProvider()
        });
        const out = await provider.transcribe({ blob: file, mimeType: file.type, name: file.name });
        setResult(out);
        showToast?.("اكتمل التفريغ", "success");
      } catch (error) {
        reportError(showNotification, error, { context: "التفريغ الصوتي" });
      }
    });
  };

  const copy = async (withTimecodes) => {
    const text = transcriptToText(result || {}, { withTimecodes });
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) { await navigator.clipboard.writeText(text); showToast?.("تم نسخ النص", "success"); }
    } catch { /* ignore */ }
  };

  const segments = Array.isArray(result?.segments) ? result.segments : [];

  return jsxs(motion.div, {
    initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 },
    className: "va-page-shell space-y-6 p-4 sm:p-6", dir: "rtl",
    children: [
      jsx(PageHero, {
        icon: jsx(Wand2, { className: "h-6 w-6 va-accent-text" }),
        title: "التفريغ الصوتي",
        description: "حوّل ملفات الصوت/الفيديو إلى نصّ بطوابع زمنية — على الخادم السحابي أو محليًّا داخل المتصفّح."
      }),

      jsxs("section", { className: "va-control-surface space-y-4 rounded-2xl va-surface-muted border p-4", children: [
        jsxs("div", { className: "flex flex-wrap gap-2", children: [
          modes.includes("cloud") && jsx(ModeButton, { active: mode === "cloud", onClick: () => setMode("cloud"), icon: jsx(Cloud, { className: "h-4 w-4" }), label: "سحابي", hint: "Whisper على الخادم (يتطلّب تسجيل الدخول)" }),
          hasLocal && jsx(ModeButton, { active: mode === "local", onClick: () => setMode("local"), icon: jsx(MonitorSmartphone, { className: "h-4 w-4" }), label: "محلي في المتصفّح", hint: "بلا خادم — يُحمّل النموذج عند أول استخدام" })
        ] }),

        jsxs("label", { htmlFor: fileInputId, className: "block cursor-pointer rounded-2xl border border-dashed border-[var(--va-border-strong)] bg-[var(--va-surface)] p-6 text-center transition-colors hover:border-emerald-500/40", children: [
          jsx(FileAudio, { className: "mx-auto h-10 w-10 text-[var(--va-text-muted)]" }),
          jsx("p", { className: "mt-2 text-sm font-semibold text-[var(--va-text)]", children: file ? file.name : "اختر ملف صوت أو فيديو" }),
          jsx("p", { className: "mt-1 text-xs text-[var(--va-text-muted)]", children: file ? formatFileSize(file.size) : "MP3 · WAV · M4A · MP4 · WEBM …" }),
          jsx("input", { id: fileInputId, type: "file", "aria-label": "اختيار ملف صوت أو فيديو للتفريغ", accept: "audio/*,video/*", className: "hidden", onChange: (e) => { setFile(e.target.files?.[0] || null); setResult(null); } })
        ] }),

        jsx("div", { className: "flex justify-end", children: jsxs("button", {
          type: "button", onClick: run, disabled: busy || !file,
          className: "btn btn-primary gap-2",
          children: [busy ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : jsx(Sparkles, { className: "h-4 w-4" }), busy ? "جارٍ التفريغ…" : "ابدأ التفريغ"]
        }) })
      ] }),

      result ? jsxs("section", { className: "space-y-4 rounded-2xl va-surface-muted border p-4", children: [
        jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
          jsxs("h2", { className: "text-base font-bold text-[var(--va-text)]", children: [`النص (${segments.length} مقطع)`] }),
          jsxs("div", { className: "flex flex-wrap gap-2", children: [
            jsxs("button", { type: "button", onClick: () => copy(false), className: "inline-flex items-center gap-1.5 rounded-lg border border-[var(--va-border-soft)] px-3 py-1.5 text-xs text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)]", children: [jsx(Copy, { className: "h-3.5 w-3.5" }), "نسخ النص"] }),
            segments.length > 0 && jsxs("button", { type: "button", onClick: () => copy(true), className: "inline-flex items-center gap-1.5 rounded-lg border border-[var(--va-border-soft)] px-3 py-1.5 text-xs text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)]", children: [jsx(Copy, { className: "h-3.5 w-3.5" }), "نسخ بالطوابع"] }),
            savedItemId
              ? jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-lg border va-accent-border va-accent-bg-soft px-3 py-1.5 text-xs va-accent-text-on-soft", children: [jsx(Check, { className: "h-3.5 w-3.5" }), "تم الحفظ"] })
              : jsxs("button", { type: "button", onClick: saveToArchive, className: "inline-flex items-center gap-1.5 rounded-lg border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-1.5 text-xs va-accent-text transition-colors hover:bg-[var(--va-elevated)]", children: [jsx(Archive, { className: "h-3.5 w-3.5" }), "حفظ كعنصر أرشيف"] })
          ] })
        ] }),
        jsx("textarea", { readOnly: true, value: transcriptToText(result), "aria-label": "النص المُفرَّغ", className: "min-h-[140px] w-full rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3 text-sm leading-7 text-[var(--va-text)] outline-none" }),
        segments.length > 0 && jsx("div", { className: "max-h-72 space-y-1 overflow-y-auto", children: segments.map((seg, i) => jsxs("div", { className: "flex gap-3 rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-1.5 text-sm", children: [
          jsx("span", { className: "shrink-0 font-[family-name:var(--va-font-mono)] text-xs va-accent-text", children: secondsToClock(seg.start) }),
          jsx("span", { className: "text-[var(--va-text-2)]", children: seg.text })
        ] }, i)) })
      ] }) : jsx("div", { className: "rounded-2xl border border-dashed border-[var(--va-border-soft)] bg-[var(--va-surface)]", children: jsx(UXStateBlock, {
        icon: jsx(FileAudio, { className: "h-14 w-14" }),
        title: "لا يوجد تفريغ بعد",
        description: "اختر ملفًا واختر مصدر التفريغ ثم اضغط ابدأ التفريغ."
      }) })
    ]
  });
}

TranscriberPage.pageId = "transcriber";
TranscriberPage.migrationStatus = "native";

export default TranscriberPage;
