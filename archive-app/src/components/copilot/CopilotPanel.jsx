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

function MessageBubble({ message }) {
  const isUser = message.role === COPILOT_ROLES.USER;
  return jsx("div", {
    className: `flex ${isUser ? "justify-start" : "justify-end"}`,
    children: jsx("div", {
      className: `max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
        isUser
          ? "va-accent-bg-soft va-accent-text-on-soft"
          : "bg-white/5 text-gray-200"
      }`,
      children: message.content
    })
  });
}

export function CopilotPanel() {
  const copilotOpen = useAppStore((s) => s.copilotOpen);
  const copilotMessages = useAppStore((s) => s.copilotMessages);
  const addCopilotMessage = useAppStore((s) => s.addCopilotMessage);
  const setCopilotOpen = useAppStore((s) => s.setCopilotOpen);
  const currentPage = useAppStore((s) => s.currentPage);
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const showToast = useAppStore((s) => s.showToast);

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
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [copilotOpen, copilotMessages.length]);

  const send = React.useCallback(
    async (text) => {
      const query = String(text || "").trim();
      if (!query || ai.isBusy) return;
      setDraft("");
      addCopilotMessage(createMessage({ role: COPILOT_ROLES.USER, content: query }));

      // Failure-safe: a rejected/unavailable provider yields null (toast already
      // shown by useAiAssist); fall back to a clear localized assistant reply so
      // the panel never leaves the user hanging and never throws.
      let reply = "";
      try {
        const history = copilotMessages.map((m) => ({ role: m.role, content: m.content }));
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

  const handleSubmit = (event) => {
    event.preventDefault();
    void send(draft);
  };

  if (!copilotOpen) return null;

  const emptyState = jsxs("div", {
    className: "flex flex-col items-center gap-2 py-8 text-center text-sm text-gray-500",
    children: [
      jsx(Bot, { className: "h-8 w-8 va-accent-text", "aria-hidden": "true" }),
      jsx("p", { children: "اسأل المساعد عن الأرشيف أو اختر اقتراحًا أدناه." })
    ]
  });

  return jsxs("aside", {
    role: "complementary",
    "aria-label": "المساعد الذكي",
    dir: "rtl",
    className:
      "va-copilot-panel fixed inset-y-0 left-0 z-[70] flex h-full w-[min(92vw,380px)] flex-col border-r border-white/10 bg-gray-950 text-right shadow-2xl",
    children: [
      jsxs("header", {
        className: "flex items-center justify-between gap-2 border-b border-white/10 p-4",
        children: [
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              jsx("span", {
                className:
                  "flex h-9 w-9 items-center justify-center rounded-xl va-accent-bg shadow-lg",
                children: jsx(Bot, { className: "h-5 w-5 text-white" })
              }),
              jsxs("div", {
                children: [
                  jsx("p", { className: "text-sm font-bold text-white", children: "المساعد الذكي" }),
                  jsx("p", { className: "text-xs text-gray-500", children: "مساعدك أثناء العمل" })
                ]
              })
            ]
          }),
          jsx("button", {
            type: "button",
            onClick: () => setCopilotOpen(false),
            "aria-label": "إغلاق المساعد الذكي",
            className:
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white",
            children: jsx(X, { className: "h-4 w-4" })
          })
        ]
      }),
      jsx("div", {
        ref: listRef,
        className: "custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4",
        children: copilotMessages.length === 0
          ? emptyState
          : copilotMessages.map((message) => jsx(MessageBubble, { message }, message.id))
      }),
      suggestedPrompts.length > 0 && jsx("div", {
        className: "flex flex-wrap gap-2 border-t border-white/10 p-3",
        children: suggestedPrompts.map((prompt) =>
          jsx("button", {
            type: "button",
            onClick: () => void send(prompt),
            disabled: ai.isBusy,
            className:
              "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40",
            children: prompt
          }, prompt)
        )
      }),
      jsxs("form", {
        onSubmit: handleSubmit,
        className: "flex items-center gap-2 border-t border-white/10 p-3",
        children: [
          jsx("input", {
            type: "text",
            value: draft,
            onChange: (event) => setDraft(event.target.value),
            disabled: ai.isBusy,
            placeholder: "اكتب رسالتك…",
            "aria-label": "رسالة إلى المساعد الذكي",
            className:
              "min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-white/20 focus:outline-none"
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
