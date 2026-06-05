import { jsx, jsxs } from "react/jsx-runtime";
import { Loader2, Sparkles, SpellCheck, Tags, WandSparkles } from "lucide-react";
import { createAiWorkbenchActions } from "./viewModel.js";

// AiAssistBar — a small row of AI assist buttons shown above notes/tags fields.
// Renders nothing when the provider is unavailable (offline/local), so content
// pages stay clean. Each button disables while any action runs and shows a
// spinner on the active one.

const ICONS = {
  summarize: jsx(WandSparkles, { className: "h-4 w-4" }),
  suggestTags: jsx(Tags, { className: "h-4 w-4" }),
  proofread: jsx(SpellCheck, { className: "h-4 w-4" })
};

function AiButton({ action, onClick, busy, disabled }) {
  return jsxs("button", {
    type: "button",
    onClick,
    disabled: disabled || busy,
    className: "flex min-h-[76px] min-w-[9rem] flex-1 items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-right text-emerald-100 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50",
    children: [
      jsx("span", { className: "mt-0.5 shrink-0 text-emerald-200", children: busy ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : ICONS[action.id] }),
      jsxs("span", { className: "min-w-0", children: [
        jsx("span", { className: "block text-sm font-semibold", children: action.label }),
        jsx("span", { className: "mt-1 block text-[11px] text-emerald-100/70", children: action.target })
      ] })
    ]
  });
}

/**
 * @param {object} props
 * @param {boolean} props.available - provider.isAvailable()
 * @param {string} props.busy - the method currently running ("" when idle)
 * @param {() => void} [props.onSummarize]
 * @param {() => void} [props.onSuggestTags]
 * @param {() => void} [props.onProofread]
 * @param {object} [props.show] - toggle individual buttons
 */
export function AiAssistBar({ available, busy = "", onSummarize, onSuggestTags, onProofread, show = {} }) {
  if (!available) return null;
  const handlers = { summarize: onSummarize, suggestTags: onSuggestTags, proofread: onProofread };
  const actions = createAiWorkbenchActions({ show }).filter((action) => typeof handlers[action.id] === "function");
  const anyBusy = Boolean(busy);
  if (!actions.length) return null;

  return jsxs("div", {
    className: "rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.045] p-3",
    dir: "rtl",
    children: [
      jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [
        jsxs("span", { className: "inline-flex items-center gap-2 text-sm font-bold text-emerald-100", children: [
          jsx(Sparkles, { className: "h-4 w-4" }), "AI Workbench"
        ] }),
        busy && jsx("span", { className: "rounded-full border border-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-100/80", children: "جار العمل" })
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
