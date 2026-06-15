import { Link2, Loader2, Plus, Tag, X } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

const { useState, useRef, useCallback, useEffect } = React;

function TagPill({ tag, onRemove }) {
  return jsxs("span", {
    className: "inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-200",
    children: [
      tag,
      jsx("button", {
        type: "button",
        onClick: () => onRemove(tag),
        className: "text-gray-400 hover:text-white",
        "aria-label": `حذف وسم ${tag}`,
        children: jsx(X, { size: 10 })
      })
    ]
  });
}

export function QuickCaptureWidget({
  onCapture,
  placeholder = "اكتب عنوان العنصر…",
  autoFocus = false,
  compact = false
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [showExtra, setShowExtra] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  const addTag = useCallback(
    (raw) => {
      const tag = raw.trim().replace(/^#/, "");
      if (!tag || tags.includes(tag)) return;
      setTags((prev) => [...prev, tag]);
      setTagInput("");
    },
    [tags]
  );

  const removeTag = useCallback((tag) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === "," || e.key === " ") {
        e.preventDefault();
        addTag(tagInput);
      } else if (e.key === "Backspace" && !tagInput && tags.length) {
        setTags((prev) => prev.slice(0, -1));
      }
    },
    [tagInput, tags, addTag]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      const trimmed = title.trim();
      if (!trimmed || submitting) return;
      setSubmitting(true);
      try {
        await onCapture?.({ title: trimmed, url: url.trim(), tags });
        setTitle("");
        setUrl("");
        setTags([]);
        setTagInput("");
        setShowExtra(false);
        titleRef.current?.focus();
      } finally {
        setSubmitting(false);
      }
    },
    [title, url, tags, submitting, onCapture]
  );

  const handleTitleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const wrapClass = compact
    ? "space-y-2"
    : "rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3";

  return jsx("form", {
    onSubmit: handleSubmit,
    "aria-label": "التقاط سريع",
    className: wrapClass,
    children: jsxs("div", {
      className: "space-y-2",
      children: [
        jsxs("div", {
          className: "flex gap-2",
          children: [
            jsx("input", {
              ref: titleRef,
              type: "text",
              value: title,
              onChange: (e) => setTitle(e.target.value),
              onKeyDown: handleTitleKeyDown,
              placeholder,
              "aria-label": "عنوان العنصر",
              dir: "rtl",
              className:
                "flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-[var(--va-action)] focus:bg-white/10 transition-colors",
              required: true,
              disabled: submitting
            }),
            jsx("button", {
              type: "button",
              onClick: () => setShowExtra((v) => !v),
              title: showExtra ? "إخفاء الخيارات" : "رابط ووسوم",
              "aria-expanded": showExtra,
              className: `rounded-xl border border-white/10 p-2 text-gray-400 transition-colors hover:text-gray-100 hover:bg-white/10 ${
                showExtra ? "bg-white/10 text-gray-100" : ""
              }`,
              children: jsx(Link2, { size: 16 })
            }),
            jsx("button", {
              type: "submit",
              disabled: !title.trim() || submitting,
              "aria-label": "التقاط العنصر",
              className:
                "rounded-xl bg-[var(--va-action)] px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-90 flex items-center gap-1.5",
              children: submitting
                ? jsx(Loader2, { size: 15, className: "animate-spin" })
                : jsx(Plus, { size: 15 })
            })
          ]
        }),
        showExtra &&
          jsxs("div", {
            className: "space-y-2",
            children: [
              jsx("input", {
                type: "url",
                value: url,
                onChange: (e) => setUrl(e.target.value),
                placeholder: "رابط اختياري…",
                "aria-label": "رابط العنصر",
                dir: "ltr",
                className:
                  "w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-[var(--va-action)] focus:bg-white/10 transition-colors"
              }),
              jsxs("div", {
                className:
                  "flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 min-h-[38px] focus-within:border-[var(--va-action)] transition-colors",
                children: [
                  jsx(Tag, { size: 12, className: "text-gray-500 shrink-0" }),
                  tags.map((t) => jsx(TagPill, { tag: t, onRemove: removeTag }, t)),
                  jsx("input", {
                    type: "text",
                    value: tagInput,
                    onChange: (e) => setTagInput(e.target.value),
                    onKeyDown: handleTagKeyDown,
                    onBlur: () => tagInput && addTag(tagInput),
                    placeholder: tags.length ? "" : "أضف وسوماً… (Enter أو فاصلة)",
                    "aria-label": "وسوم",
                    dir: "rtl",
                    className:
                      "flex-1 min-w-[80px] bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none"
                  })
                ]
              })
            ]
          })
      ]
    })
  });
}
