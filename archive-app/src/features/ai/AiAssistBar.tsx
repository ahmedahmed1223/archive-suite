import { jsx, jsxs } from "react/jsx-runtime";
import { Loader2, Sparkles, SpellCheck, Tags, WandSparkles } from "lucide-react";
import type { ReactNode } from "react";

import { createAiWorkbenchActions } from "./viewModel.js";
import type { WorkbenchAction } from "./viewModel.js";

// AiAssistBar — a small row of AI assist buttons shown above notes/tags fields.
// Renders nothing when the provider is unavailable (offline/local), so content
// pages stay clean. Each button disables while any action runs and shows a
// spinner on the active one.

const ICONS: Record<string, ReactNode> = {
  summarize: jsx(WandSparkles, { className: "h-4 w-4" }),
  suggestTags: jsx(Tags, { className: "h-4 w-4" }),
  proofread: jsx(SpellCheck, { className: "h-4 w-4" })
};

interface AiButtonProps {
  action: WorkbenchAction;
  onClick?: () => void;
  busy: boolean;
  disabled: boolean;
}

interface AiAssistBarProps {
  available: boolean;
  busy?: string;
  onSummarize?: () => void;
  onSuggestTags?: () => void;
  onProofread?: () => void;
  show?: Partial<Record<"summarize" | "tags" | "proofread", boolean>>;
}

function AiButton({ action, onClick, busy, disabled }: AiButtonProps) {
  return jsxs("button", {
    type: "button",
    onClick,
    disabled: disabled || busy,
    className: "flex min-h-[76px] min-w-[9rem] flex-1 items-start gap-2 rounded-xl border va-accent-border va-accent-bg-soft p-3 text-right va-accent-text-on-soft transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50",
    children: [
      jsx("span", { className: "mt-0.5 shrink-0 va-accent-text-on-soft", children: busy ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : ICONS[action.id] }),
      jsxs("span", { className: "min-w-0", children: [
        jsx("span", { className: "block text-sm font-semibold", children: action.label }),
        jsx("span", { className: "mt-1 block text-[11px] va-accent-text-on-soft", children: action.target })
      ] })
    ]
  });
}

export function AiAssistBar({ available, busy = "", onSummarize, onSuggestTags, onProofread, show = {} }: AiAssistBarProps) {
  if (!available) return null;
  const handlers: Record<string, (() => void) | undefined> = { summarize: onSummarize, suggestTags: onSuggestTags, proofread: onProofread };
  const actions = createAiWorkbenchActions({ show }).filter((action) => typeof handlers[action.id] === "function");
  const anyBusy = Boolean(busy);
  if (!actions.length) return null;

  return jsxs("div", {
    className: "rounded-2xl border va-accent-border va-accent-bg/[0.045] p-3",
    dir: "rtl",
    children: [
      jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [
        jsxs("span", { className: "inline-flex items-center gap-2 text-sm font-bold va-accent-text-on-soft", children: [
          jsx(Sparkles, { className: "h-4 w-4" }), "AI Workbench"
        ] }),
        busy && jsx("span", { className: "rounded-full border va-accent-border px-2 py-0.5 text-[11px] va-accent-text-on-soft", children: "جار العمل" })
      ] }),
      jsx("div", { className: "grid gap-2 sm:grid-cols-3", children: actions.map((action) => jsx(AiButton, {
        action,
        onClick: handlers[action.id],
        busy: busy === action.method,
        disabled: anyBusy
      }, action.id)) })
    ]
  });
}

export default AiAssistBar;
