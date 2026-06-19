// Detail-page next/previous navigator (§1408).
//
// Lets the user step through the current filtered archive list without going
// back to the archive. Position + adjacency are computed by the pure
// navigationContext module; this component is presentation only.
//
// RTL note: "previous" sits on the right (ChevronRight) and "next" on the left
// (ChevronLeft) to match Arabic reading direction.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";

/**
 * @param {{
 *   position: { index:number, total:number, hasPrevious:boolean, hasNext:boolean }|null,
 *   onPrevious: () => void,
 *   onNext: () => void
 * }} props
 */
export function DetailNavigationPanel({ position, onPrevious, onNext }) {
  if (!position || position.total <= 1 || position.index < 0) return null;

  const { index, total, hasPrevious, hasNext } = position;
  const counterLabel = `${index + 1} / ${total}`;

  const buttonClass = (enabled) => [
    "inline-flex items-center gap-1 rounded-[var(--va-radius-md)] border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
    enabled
      ? "border-[var(--va-border-soft)] text-[var(--va-text-2)] hover:border-[var(--va-border-strong)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]"
      : "cursor-not-allowed border-[var(--va-border-soft)] text-[var(--va-text-muted)] opacity-60"
  ].join(" ");

  return jsxs("div", {
    className: "inline-flex items-center gap-2",
    role: "group",
    "aria-label": "التنقل بين المواد",
    children: [
      jsxs("button", {
        type: "button",
        onClick: hasPrevious ? onPrevious : undefined,
        disabled: !hasPrevious,
        "aria-label": "المادة السابقة",
        className: buttonClass(hasPrevious),
        children: [jsx(ChevronRight, { className: "h-3.5 w-3.5" }), "السابق"]
      }),
      jsx("span", {
        className: "min-w-[3.5rem] text-center text-[11px] tabular-nums text-[var(--va-text-muted)]",
        children: counterLabel
      }),
      jsxs("button", {
        type: "button",
        onClick: hasNext ? onNext : undefined,
        disabled: !hasNext,
        "aria-label": "المادة التالية",
        className: buttonClass(hasNext),
        children: ["التالي", jsx(ChevronLeft, { className: "h-3.5 w-3.5" })]
      })
    ]
  });
}

export default DetailNavigationPanel;
