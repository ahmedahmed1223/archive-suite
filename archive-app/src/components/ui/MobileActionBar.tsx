import * as React from "react";

import { cx } from "./V1Primitives.jsx";

export interface MobileActionBarAction {
  id?: string | number;
  label: React.ReactNode;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconNode?: React.ReactNode;
}

export interface MobileActionBarProps {
  actions?: Array<MobileActionBarAction | null | undefined | false>;
  label?: string;
  className?: string;
}

export function MobileActionBar({
  actions = [],
  label = "إجراءات الصفحة",
  className = "",
}: MobileActionBarProps) {
  const visibleActions = actions.filter(Boolean).slice(0, 5) as MobileActionBarAction[];
  if (!visibleActions.length) return null;

  return (
    <nav
      className={cx(
        "dock dock-sm fixed inset-x-2 z-[35] mx-auto max-w-2xl rounded-2xl border border-white/10 bg-gray-950/92 p-2 shadow-2xl shadow-black/35 backdrop-blur md:hidden",
        className
      )}
      style={{ bottom: "var(--va-mobile-action-bar-bottom)" }}
      dir="rtl"
      aria-label={label}
    >
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${visibleActions.length}, minmax(0, 1fr))` }}
      >
        {visibleActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id ?? `action-${index}`}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              aria-pressed={action.active}
              className={cx(
                "inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                action.active ? "dock-active" : "",
                action.primary
                  ? "btn btn-primary"
                  : action.active
                    ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft"
                    : "border-white/10 bg-white/[0.035] text-gray-300 hover:bg-white/[0.07] hover:text-white"
              )}
              title={
                typeof action.title === "string"
                  ? action.title
                  : typeof action.label === "string"
                    ? action.label
                    : undefined
              }
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : action.iconNode}
              <span className="dock-label max-w-full truncate">{action.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileActionBar;
