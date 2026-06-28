import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type CardVariant = "solid" | "subtle";

export interface CardV2Props extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

type CardSlotProps = React.HTMLAttributes<HTMLDivElement>;

const VARIANTS: Record<CardVariant, string> = {
  solid:
    "bg-[var(--va-surface)] border border-[var(--va-border-soft)] " +
    "shadow-[var(--va-elev-1,0_1px_2px_rgba(0,0,0,0.05))]",
  subtle: "bg-[var(--va-surface-2)] border border-transparent",
};

function CardV2Base({ variant = "solid", className = "", children, ...rest }: CardV2Props) {
  return (
    <div
      dir="rtl"
      className={cx(
        "rounded-[var(--va-radius-lg)] overflow-hidden text-[var(--va-text)]",
        VARIANTS[variant] ?? VARIANTS.solid,
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardV2Header({ className = "", children, ...rest }: CardSlotProps) {
  return (
    <div
      className={cx(
        "px-[var(--va-card-padding)] pt-[var(--va-card-padding)]",
        "border-b border-[var(--va-border-soft)] pb-3",
        "text-base font-medium text-[var(--va-text)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardV2Body({ className = "", children, ...rest }: CardSlotProps) {
  return (
    <div
      className={cx(
        "px-[var(--va-card-padding)] py-[var(--va-card-padding)]",
        "text-sm text-[var(--va-text-2)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardV2Footer({ className = "", children, ...rest }: CardSlotProps) {
  return (
    <div
      className={cx(
        "px-[var(--va-card-padding)] pb-[var(--va-card-padding)] pt-3",
        "border-t border-[var(--va-border-soft)]",
        "flex items-center justify-end gap-2",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

type CardCompound = React.FC<CardV2Props> & {
  Header: React.FC<CardSlotProps>;
  Body: React.FC<CardSlotProps>;
  Footer: React.FC<CardSlotProps>;
};

export const CardV2 = Object.assign(CardV2Base, {
  Header: CardV2Header,
  Body: CardV2Body,
  Footer: CardV2Footer,
}) as CardCompound;

CardV2.displayName = "CardV2";
CardV2.Header.displayName = "CardV2.Header";
CardV2.Body.displayName = "CardV2.Body";
CardV2.Footer.displayName = "CardV2.Footer";
