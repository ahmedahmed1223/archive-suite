import { Pencil } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

const DEFAULT_MAX_LENGTH = 500;

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--va-action)]/60 bg-gray-900/80 px-2.5 py-1.5 text-sm text-white " +
  "outline-none ring-2 ring-[var(--va-action)]/30 focus:ring-[var(--va-action)]/60 " +
  "placeholder:text-gray-500 disabled:opacity-50";

function tagsToText(value) {
  if (Array.isArray(value)) return value.join("، ");
  if (typeof value === "string") return value;
  return "";
}

function textToTags(text) {
  return String(text || "")
    .split(/[،,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function displayText(value, fieldType, options, placeholder) {
  if (fieldType === "tags") {
    const tags = Array.isArray(value) ? value : textToTags(value);
    return tags.length ? tags.join("، ") : placeholder || "—";
  }
  if (fieldType === "select") {
    const match = options.find((option) => String(option.value) === String(value));
    return match ? match.label : value || placeholder || "—";
  }
  if (value === null || value === undefined || value === "") {
    return placeholder || "—";
  }
  return String(value);
}

function readValue(fieldType, raw) {
  if (fieldType === "tags") return textToTags(raw);
  if (fieldType === "number") {
    if (raw === "" || raw === null || raw === undefined) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return raw;
}

function DisplayMode({ text, isEmpty, ariaLabel, disabled, onStartEdit }) {
  return jsxs("button", {
    type: "button",
    disabled,
    onClick: disabled ? undefined : onStartEdit,
    "aria-label": ariaLabel,
    dir: "rtl",
    className:
      "group flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 text-right text-sm " +
      "transition-colors hover:border-white/10 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--va-action)]/40 " +
      (disabled ? "cursor-default opacity-70" : "cursor-text"),
    children: [
      jsx("span", {
        className: "min-w-0 flex-1 truncate " + (isEmpty ? "text-gray-500" : "text-white"),
        children: text
      }),
      disabled
        ? null
        : jsx(Pencil, {
            className: "h-3.5 w-3.5 shrink-0 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100",
            "aria-hidden": "true"
          })
    ]
  });
}

function EditField({ fieldType, draft, setDraft, options, placeholder, maxLength, inputRef, onKeyDown, onBlur, ariaLabel }) {
  const shared = {
    ref: inputRef,
    dir: "rtl",
    "aria-label": ariaLabel,
    className: INPUT_CLASS,
    onKeyDown,
    onBlur,
    value: draft,
    onChange: (event) => setDraft(event.target.value)
  };

  if (fieldType === "select") {
    return jsxs("select", {
      ...shared,
      children: [
        jsx("option", { value: "", children: placeholder || "—" }, "__empty"),
        ...options.map((option) =>
          jsx("option", { value: String(option.value), children: option.label }, String(option.value))
        )
      ]
    });
  }

  const typeMap = { text: "text", tags: "text", number: "number", date: "date" };
  return jsx("input", {
    ...shared,
    type: typeMap[fieldType] || "text",
    placeholder: placeholder || "",
    maxLength: fieldType === "text" || fieldType === "tags" ? maxLength : undefined
  });
}

export function InlineCellEditor({
  value,
  fieldType = "text",
  options = [],
  onSave,
  onCancel,
  isEditing = false,
  onStartEdit,
  placeholder = "اكتب هنا…",
  maxLength = DEFAULT_MAX_LENGTH,
  disabled = false
}) {
  const inputRef = React.useRef(null);
  const committedRef = React.useRef(false);
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    if (!isEditing) return;
    committedRef.current = false;
    setDraft(fieldType === "tags" ? tagsToText(value) : value == null ? "" : String(value));
    const node = inputRef.current;
    if (node) {
      node.focus();
      if (typeof node.select === "function") node.select();
    }
  }, [isEditing, fieldType, value]);

  const ariaLabel = `${placeholder} — ${isEditing ? "وضع التحرير" : "اضغط للتحرير"}`;

  if (!isEditing) {
    const text = displayText(value, fieldType, options, placeholder);
    const isEmpty = text === (placeholder || "—") || text === "—";
    return jsx(DisplayMode, {
      text,
      isEmpty,
      ariaLabel,
      disabled,
      onStartEdit: () => onStartEdit?.()
    });
  }

  const commit = (meta = {}) => {
    if (committedRef.current) return;
    committedRef.current = true;
    onSave?.(readValue(fieldType, draft), meta);
  };

  const cancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel?.();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && fieldType !== "select") {
      event.preventDefault();
      commit();
    } else if (event.key === "Tab") {
      event.preventDefault();
      commit({ navigationDirection: event.shiftKey ? "previous" : "next" });
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  return jsx("div", {
    className: "w-full",
    children: jsx(EditField, {
      fieldType,
      draft,
      setDraft,
      options,
      placeholder,
      maxLength,
      inputRef,
      ariaLabel,
      onKeyDown: handleKeyDown,
      onBlur: commit
    })
  });
}

InlineCellEditor.displayName = "InlineCellEditor";
InlineCellEditor.componentId = "inline-cell-editor";

export default InlineCellEditor;
