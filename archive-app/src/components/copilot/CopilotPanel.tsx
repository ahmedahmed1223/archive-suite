/**
 * CopilotPanel — a collapsible, right-side AI assistant drawer reachable from
 * anywhere in the app shell. It reuses the existing AiProvider seam through
 * useAiAssist().chat; when no provider is configured the send path degrades to a
 * graceful, localized "AI not available" reply instead of crashing.
 *
 * Rendered once from AppRouter so it floats above every page (RTL, slide-in).
 */
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Bot, Send, X } from "lucide-react";

import { useAppStore } from "../../stores/index.js";
import { useAiAssist } from "../../features/ai/useAiAssist.js";
import {
  COPILOT_ROLES,
  buildSuggestedPrompts,
  createMessage
} from "../../features/copilot/copilotModel.js";

const UNAVAILABLE_REPLY =
  "المساعد الذكي غير مُهيّأ في الوضع الحالي. هيّئ مزوّد ذكاء من الإعدادات (النسخة السحابية) لتفعيل المحادثة.";

function MessageBubble({ message }: any) {
  const isUser = message.role === COPILOT_ROLES.USER;
  return jsx("div", {
    className: `flex ${isUser ? "justify-start" : "justify-end"}`,
    children: jsx("div", {
      className: `max-w-[85%] whitespace-pre-wrap rounded-[var(--va-radius-lg)] px-3 py-2 text-sm ${
        isUser
          ? "bg-emerald-500/12 text-emerald-500 border border-emerald-500/25"
          : "bg-[var(--va-surface-2)] text-[var(--va-text-2)] border border-[var(--va-border-soft)]"
      }`,
      children: message.content
    })
  });
}

export function CopilotPanel() {
  const copilotOpen = useAppStore((s: any) => s.copilotOpen);
  const copilotMessages = useAppStore((s: any) => s.copilotMessages);
  const addCopilotMessage = useAppStore((s: any) => s.addCopilotMessage);
  const setCopilotOpen = useAppStore((s: any) => s.setCopilotOpen);
  const currentPage = useAppStore((s: any) => s.currentPage);
  const selectedItemId = useAppStore((s: any) => s.selectedItemId);
  const showToast = useAppStore((s: any) => s.showToast);

  const ai = useAiAssist({ showToast });
  const [draft, setDraft] = React.useState("");
  const listRef = React.useRef(null);

  const context = React.useMemo(
    () => ({ page: currentPage, hasSelection: Boolean(selectedItemId) }),
    [currentPage, selectedItemId]
  );
  const suggestedPrompts = React.useMemo(() => buildSuggestedPrompts(context), [context]);

  React.useEffect(() => {
    if (copilotOpen && listRef.current) {
      (listRef.current as any).scrollTop = (listRef.current as any).scrollHeight;
    }
  }, [copilotOpen, copilotMessages.length]);

  const send = React.useCallback(
    async (text: any) => {
      const query = String(text || "").trim();
      if (!query || ai.isBusy) return;
      setDraft("");
      addCopilotMessage(createMessage({ role: COPILOT_ROLES.USER, content: query }));

      // Failure-safe: a rejected/unavailable provider yields null (toast already
      // shown by useAiAssist); fall back to a clear localized assistant reply so
      // the panel never leaves the user hanging and never throws.
      let reply = "";
      try {
        const history = copilotMessages.map((m: any) => ({ role: m.role, content: m.content }));
        const result = await ai.chat({ context, query, history });
        reply = typeof result === "string" ? result.trim() : "";
      } catch {
        reply = "";
      }
      addCopilotMessage(
        createMessage({
          role: COPILOT_ROLES.ASSISTANT,
          content: reply || UNAVAILABLE_REPLY
        })
      );
    },
    [ai, addCopilotMessage, context, copilotMessages]
  );

  const handleSubmit = (event: any) => {
    event.preventDefault();
    void send(draft);
  };

  if (!copilotOpen) return null;

  const emptyState = jsxs("div", {
    className: "flex flex-col items-center gap-2 py-8 text-center text-sm text-[var(--va-text-muted)]",
    children: [
      jsx(Bot, { className: "h-8 w-8 text-emerald-500", "aria-hidden": "true" }),
      jsx("p", { children: "اسأل المساعد عن الأرشيف أو اختر اقتراحًا أدناه." })
    ]
  });

  return jsxs("aside", {
    role: "complementary",
    "aria-label": "المساعد الذكي",
    dir: "rtl",
    className:
      "va-copilot-panel fixed inset-y-0 left-0 z-[70] flex h-full w-[min(92vw,380px)] flex-col border-r border-[var(--va-border-soft)] bg-[var(--va-surface)] text-right text-[var(--va-text)] shadow-[var(--va-elev-popover)]",
    children: [
      jsxs("header", {
        className: "flex items-center justify-between gap-2 border-b border-[var(--va-border-soft)] p-4",
        children: [
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              jsx("span", {
                className:
                  "flex h-9 w-9 items-center justify-center rounded-[var(--va-radius-lg)] bg-emerald-500 shadow-[var(--va-elev-2)]",
                children: jsx(Bot, { className: "h-5 w-5 text-[var(--va-text-inverse)]" })
              }),
              jsxs("div", {
                children: [
                  jsx("p", { className: "text-sm font-bold text-[var(--va-text)]", children: "المساعد الذكي" }),
                  jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: "مساعدك أثناء العمل" })
                ]
              })
            ]
          }),
          jsx("button", {
            type: "button",
            onClick: () => setCopilotOpen(false),
            "aria-label": "إغلاق المساعد الذكي",
            className:
              "inline-flex h-8 w-8 items-center justify-center rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] text-[var(--va-text-muted)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]",
            children: jsx(X, { className: "h-4 w-4" })
          })
        ]
      }),
      jsx("div", {
        ref: listRef,
        className: "custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4",
        children: copilotMessages.length === 0
          ? emptyState
          : copilotMessages.map((message: any) => jsx(MessageBubble, { message }, message.id))
      }),
      suggestedPrompts.length > 0 && jsx("div", {
        className: "flex flex-wrap gap-2 border-t border-[var(--va-border-soft)] p-3",
        children: suggestedPrompts.map((prompt: any) =>
          jsx("button", {
            type: "button",
            onClick: () => void send(prompt),
            disabled: ai.isBusy,
            className:
              "rounded-full border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-1 text-xs text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-elevated)] hover:text-[var(--va-text)] disabled:opacity-40",
            children: prompt
          }, prompt)
        )
      }),
      jsxs("form", {
        onSubmit: handleSubmit,
        className: "flex items-center gap-2 border-t border-[var(--va-border-soft)] p-3",
        children: [
          jsx("input", {
            type: "text",
            value: draft,
            onChange: (event: any) => setDraft(event.target.value),
            disabled: ai.isBusy,
            placeholder: "اكتب رسالتك…",
            "aria-label": "رسالة إلى المساعد الذكي",
            className:
              "min-w-0 flex-1 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] placeholder:text-[var(--va-text-muted)] focus:border-emerald-500/60 focus:outline-none"
          }),
          jsx("button", {
            type: "submit",
            disabled: ai.isBusy || !draft.trim(),
            "aria-label": "إرسال",
            className:
              "btn btn-primary h-10 w-10 shrink-0",
            children: jsx(Send, { className: "h-4 w-4" })
          })
        ]
      })
    ]
  });
}

CopilotPanel.displayName = "CopilotPanel";

export default CopilotPanel;
