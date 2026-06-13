import * as React from "react";

import { normalizeArabicSearchText } from "../../utils/formatting.js";

const TYPE_BUFFER_TIMEOUT_MS = 850;

function isTypeable(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const key = event.key;
  if (!key || key.length !== 1) return false;
  // Allow letters, digits, Arabic chars, simple punctuation.
  return /[\p{L}\p{N} \-_.@#]/u.test(key);
}

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Type-to-jump: as the user types letters anywhere on the page, find
 * the first archive item whose normalized title starts with the buffer
 * and call `onMatch(item)`. The buffer resets after 850ms of idle time.
 *
 * Pass an items array sorted in the same order the user sees them.
 *
 * Disabled when the active element is editable so it doesn't fight the
 * search input or any other form field.
 */
export function useTypeToJump({ items = [], enabled = true, onMatch }) {
  const bufferRef = React.useRef("");
  const timeoutRef = React.useRef(null);
  const [buffer, setBuffer] = React.useState("");

  const reset = React.useCallback(() => {
    bufferRef.current = "";
    setBuffer("");
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return undefined;
    const handler = (event) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        reset();
        return;
      }
      if (!isTypeable(event)) return;
      event.preventDefault();
      const next = bufferRef.current + event.key;
      bufferRef.current = next;
      setBuffer(next);
      const normalized = normalizeArabicSearchText(next);
      const match = items.find((item) => {
        const title = normalizeArabicSearchText(item.title || "");
        return title.startsWith(normalized);
      }) || items.find((item) => {
        const title = normalizeArabicSearchText(item.title || "");
        return title.includes(normalized);
      });
      if (match) onMatch?.(match);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(reset, TYPE_BUFFER_TIMEOUT_MS);
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [enabled, items, onMatch, reset]);

  return { buffer, reset };
}
