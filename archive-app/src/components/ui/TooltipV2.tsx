import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type TooltipPosition = "top" | "bottom" | "start" | "end";

export interface TooltipV2Props {
  children: React.ReactElement;
  content: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
}

const POSITION_STYLES: Record<TooltipPosition, React.CSSProperties> = {
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

export function TooltipV2({
  children,
  content,
  position = "top",
  delay = 300,
}: TooltipV2Props) {
  const [visible, setVisible] = React.useState(false);
  const tooltipId = React.useId();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const posStyle = POSITION_STYLES[position] || POSITION_STYLES.top;

  const show = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (delay > 0) {
      timerRef.current = setTimeout(() => setVisible(true), delay);
    } else {
      setVisible(true);
    }
  }, [delay]);

  const hide = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const child = React.Children.only(children) as React.ReactElement<React.HTMLAttributes<HTMLElement>>;

  const triggerProps: React.HTMLAttributes<HTMLElement> = {
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
  };

  const trigger = React.cloneElement(child, triggerProps);

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
