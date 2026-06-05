import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

/**
 * Single key chip — renders one keyboard key inside a styled <kbd>.
 * Use `Kbd` for inline mentions inside paragraphs and `KbdHint` for
 * the trailing decoration on a button.
 */
export function Kbd({ children, size = "sm", className = "" }) {
  const sizeClass = size === "xs"
    ? "min-w-[1.25rem] px-1 py-0.5 text-[10px]"
    : size === "md"
      ? "min-w-[1.75rem] px-2 py-1 text-xs"
      : "min-w-[1.5rem] px-1.5 py-0.5 text-[11px]";
  return jsx("kbd", {
    className: `inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.07] font-mono font-semibold leading-none text-gray-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.25)] ${sizeClass} ${className}`,
    dir: "ltr",
    children
  });
}

/**
 * Keyboard hint chip — renders a combination like Ctrl+K or just A
 * as a small trailing decoration. The combo array is rendered with
 * "+" separators between keys (LTR for proper key-name reading).
 *
 * Examples:
 *   <KbdHint keys={["A"]} />            → A
 *   <KbdHint keys={["Ctrl", "K"]} />    → Ctrl + K
 *   <KbdHint keys={["?"]} label="مساعدة" />
 */
export function KbdHint({ keys = [], size = "xs", className = "" }) {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  return jsx("span", {
    className: `inline-flex items-center gap-1 ${className}`,
    dir: "ltr",
    "aria-hidden": true,
    children: keys.flatMap((key, index) => {
      const node = jsx(Kbd, { size, children: key }, `key-${index}`);
      if (index === 0) return [node];
      return [
        jsx("span", { className: "text-[10px] text-gray-500", children: "+" }, `sep-${index}`),
        node
      ];
    })
  });
}

export default KbdHint;
