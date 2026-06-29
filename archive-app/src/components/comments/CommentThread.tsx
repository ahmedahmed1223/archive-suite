import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Inbox, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";

import { TagAutocomplete } from "../forms/TagAutocomplete.jsx";
import { canDeleteComment } from "../../features/comments/viewModel.js";
import { formatDateTime } from "../../utils/formatting.js";

export function CommentThread({
  comments = [],
  currentUser = null,
  draft = "",
  busy = false,
  onDraftChange,
  onSubmit,
  onRemove,
  sectionRef,
  className = ""
}: any) {
  const safeComments = Array.isArray(comments) ? comments : [];

  return jsxs("section", {
    ref: sectionRef,
    className: `rounded-xl va-surface-subtle border p-3 ${className}`,
    "aria-labelledby": "item-comments-heading",
    children: [
      jsxs("div", {
        className: "flex items-start justify-between gap-3",
        children: [
          jsxs("div", {
            className: "min-w-0",
            children: [
              jsxs("h2", {
                id: "item-comments-heading",
                className: "flex items-center gap-2 text-base font-bold text-white",
                children: [
                  jsx(MessageSquare, { className: "h-4 w-4 va-accent-text", "aria-hidden": true }),
                  "التعليقات"
                ]
              }),
              jsx("p", {
                className: "mt-1 text-xs leading-5 text-base-content/50",
                children: "ملاحظات الفريق والذكر المرتبط بهذه المادة."
              })
            ]
          }),
          jsx("span", {
            className: "badge badge-sm badge-ghost shrink-0",
            "aria-label": `عدد التعليقات ${safeComments.length}`,
            children: safeComments.length
          })
        ]
      }),
      jsxs("div", {
        className: "mt-3 space-y-2",
        children: [
          jsx(TagAutocomplete, {
            multiline: true,
            value: draft,
            onChange: onDraftChange,
            rows: 3,
            allowed: ["users", "vocabulary", "tags"],
            placeholder: "اكتب ملاحظة للفريق حول هذه المادة...",
            className: "textarea textarea-bordered w-full"
          }),
          jsxs("button", {
            type: "button",
            onClick: onSubmit,
            disabled: busy || !String(draft || "").trim(),
            className: "btn btn-primary btn-sm gap-2",
            children: [
              busy
                ? jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin", "aria-hidden": true })
                : jsx(Send, { className: "h-3.5 w-3.5", "aria-hidden": true }),
              "إرسال"
            ]
          })
        ]
      }),
      safeComments.length
        ? jsx("ul", {
            className: "mt-4 space-y-2",
            children: safeComments.map((comment: any) => jsxs("li", {
              className: "rounded-xl border border-white/10 bg-base-200/35 p-3",
              children: [
                jsxs("div", {
                  className: "flex items-start justify-between gap-2",
                  children: [
                    jsxs("div", {
                      className: "min-w-0",
                      children: [
                        jsx("p", { className: "truncate text-sm font-semibold text-base-content", children: comment.author }),
                        jsx("p", {
                          className: "mt-0.5 text-[11px] text-base-content/50",
                          children: comment.createdAt ? formatDateTime(comment.createdAt) : ""
                        })
                      ]
                    }),
                    canDeleteComment(comment, currentUser) && jsx("button", {
                      type: "button",
                      onClick: () => onRemove?.(comment),
                      "aria-label": "حذف التعليق",
                      className: "btn btn-ghost btn-xs btn-square text-base-content/50 hover:text-error",
                      children: jsx(Trash2, { className: "h-3.5 w-3.5", "aria-hidden": true })
                    })
                  ]
                }),
                jsx("p", {
                  className: "mt-2 whitespace-pre-wrap text-sm leading-6 text-base-content/80",
                  dir: "auto",
                  children: comment.text
                })
              ]
            }, comment.id))
          })
        : jsxs("div", {
            className: "mt-4 rounded-xl border border-dashed border-base-content/15 bg-base-200/20 p-4 text-center",
            children: [
              jsx(Inbox, { className: "mx-auto h-6 w-6 text-base-content/35", "aria-hidden": true }),
              jsx("p", { className: "mt-2 text-sm font-medium text-base-content/70", children: "لا توجد تعليقات بعد." }),
              jsx("p", { className: "mt-1 text-xs text-base-content/45", children: "ابدأ بتعليق قصير أو اذكر زميلاً باستخدام @." })
            ]
          })
    ]
  });
}

export default CommentThread;
