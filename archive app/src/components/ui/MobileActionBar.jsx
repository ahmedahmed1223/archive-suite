import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { cx } from "./V1Primitives.jsx";

export function MobileActionBar({ actions = [], label = "إجراءات الصفحة", className = "" }) {
  const visibleActions = actions.filter(Boolean).slice(0, 5);
  if (!visibleActions.length) return null;

  return jsx("nav", {
    className: cx(
      // bottom offset clears the fixed BottomTabBar (56px + safe-area) so the
      // page action bar never covers the global navigation tabs on phones.
      "fixed inset-x-2 z-[35] mx-auto max-w-2xl rounded-2xl border border-white/10 bg-gray-950/92 p-2 shadow-2xl shadow-black/35 backdrop-blur md:hidden",
      className
    ),
    style: { bottom: "var(--va-mobile-action-bar-bottom)" },
    dir: "rtl",
    "aria-label": label,
    children: jsx("div", {
      className: "grid gap-1.5",
      style: { gridTemplateColumns: `repeat(${visibleActions.length}, minmax(0, 1fr))` },
      children: visibleActions.map((action) => {
        const Icon = action.icon;
        return jsxs("button", {
          type: "button",
          onClick: action.onClick,
          disabled: action.disabled,
          "aria-pressed": action.active,
          className: cx(
            "inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
            action.primary
              ? "va-primary-button border-transparent text-white"
              : action.active
                ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft"
                : "border-white/10 bg-white/[0.035] text-gray-300 hover:bg-white/[0.07] hover:text-white"
          ),
          title: action.title || action.label,
          children: [
            Icon ? jsx(Icon, { className: "h-4 w-4 shrink-0" }) : action.iconNode,
            jsx("span", { className: "max-w-full truncate", children: action.label })
          ]
        }, action.id || action.label);
      })
    })
  });
}

export default MobileActionBar;
