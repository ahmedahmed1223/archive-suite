import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

/**
 * Controlled 1–5 star rating widget.
 * - Interactive (default): clickable stars with hover preview, keyboard-accessible.
 * - Readonly: displays filled/empty stars only.
 * - Clicking the current value star resets to 0 (unrated).
 * - RTL-aware: rendered in a dir-neutral way (flex row is directional but stars
 *   themselves are symmetric so no RTL adjustment is needed).
 */
export function StarRating({ value = 0, onChange, readonly = false, size = "md" }) {
  const [hovered, setHovered] = React.useState(0);
  const numericValue = Number(value) || 0;
  const display = !readonly && hovered > 0 ? hovered : numericValue;
  const textSize = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-xl";

  if (readonly) {
    return jsxs("span", {
      className: `inline-flex items-center gap-px ${textSize}`,
      "aria-label": numericValue > 0 ? `تقييم ${numericValue} من 5` : "غير مقيّم",
      children: [1, 2, 3, 4, 5].map((star) => jsx("span", {
        "aria-hidden": "true",
        className: star <= numericValue ? "text-amber-400" : "text-gray-600",
        children: "★"
      }, star))
    });
  }

  return jsxs("div", {
    className: `inline-flex items-center gap-px ${textSize}`,
    role: "group",
    "aria-label": "تقييم من 5 نجوم",
    onMouseLeave: () => setHovered(0),
    children: [1, 2, 3, 4, 5].map((star) => jsx("button", {
      type: "button",
      onClick: () => onChange?.(star === numericValue ? 0 : star),
      onMouseEnter: () => setHovered(star),
      "aria-label": `${star} من 5`,
      "aria-pressed": star === numericValue,
      className: `transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60 rounded-sm ${star <= display ? "text-amber-400" : "text-gray-600"} hover:text-amber-300`,
      children: "★"
    }, star))
  });
}

export default StarRating;
