/**
 * TooltipV2 — Design System v2 tooltip.
 *
 * Shows on hover and focus (keyboard-accessible). RTL-safe: positions use
 * CSS logical properties (inset-inline-start/end). No external lib.
 *
 * @param {{ children: React.ReactNode, content: React.ReactNode, position?: 'top'|'bottom'|'start'|'end', delay?: number }} props
 */
import * as React from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

/* ── Position map using CSS logical properties ── */

const POSITION_STYLES = {
  top: {
    bottom: "calc(100% + 0.375rem)",
    insetInlineStart: "50%",
    transform: "translateX(-50%)",
  },
  bottom: {
    top: "calc(100% + 0.375rem)",
    insetInlineStart: "50%",
    transform: "translateX(-50%)",
  },
  start: {
    top: "50%",
    insetInlineEnd: "calc(100% + 0.375rem)",
    transform: "translateY(-50%)",
  },
  end: {
    top: "50%",
    insetInlineStart: "calc(100% + 0.375rem)",
    transform: "translateY(-50%)",
  },
};

/**
 * TooltipV2 — wrapper that shows a tooltip on hover/focus.
 *
 * @example
 * <TooltipV2 content="تفاصيل إضافية" position="top">
 *   <button>حوّم هنا</button>
 * </TooltipV2>
 */
export function TooltipV2({ children, content, position = "top", delay = 300 }) {
  const [visible, setVisible] = React.useState(false);
  const tooltipId = React.useId();
  const timerRef = React.useRef(null);

  const posStyle = POSITION_STYLES[position] || POSITION_STYLES.top;

  const show = React.useCallback(() => {
    clearTimeout(timerRef.current);
    if (delay > 0) {
      timerRef.current = setTimeout(() => setVisible(true), delay);
    } else {
      setVisible(true);
    }
  }, [delay]);

  const hide = React.useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  /* Clean up timer on unmount */
  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  const child = React.Children.only(children);

  const trigger = React.cloneElement(child, {
    "aria-describedby": visible ? tooltipId : undefined,
    onMouseEnter: (e) => {
      show();
      child.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e) => {
      hide();
      child.props.onMouseLeave?.(e);
    },
    onFocus: (e) => {
      show();
      child.props.onFocus?.(e);
    },
    onBlur: (e) => {
      hide();
      child.props.onBlur?.(e);
    },
  });

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      {trigger}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: "var(--va-z-tooltip, 8500)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            ...posStyle,
          }}
          className={cx(
            "rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)]",
            "bg-[var(--va-elevated)] px-2 py-1 text-xs text-[var(--va-text)]",
            "shadow-[var(--va-elev-popover)]"
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
