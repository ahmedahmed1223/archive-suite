import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export type SkeletonProps = {
  /** Text announced to screen readers instead of decorative shapes. */
  label?: string;
  /** Number of placeholder lines to show (minimum one line). */
  lines?: number;
  /** "text" renders variable-width text lines; "block" renders a solid card or media area. */
  variant?: "text" | "block";
  className?: string;
};

/**
 * A shared loading state: the shapes are decorative and hidden from assistive
 * technologies, while its fallback label is announced through a polite live region.
 * CSS disables the shimmer with prefers-reduced-motion.
 */
export function Skeleton({
  label,
  lines = 3,
  variant = "text",
  className = ""
}: Readonly<SkeletonProps>): ReactNode {
  const { t } = useLocale();
  const barCount = Math.max(1, Math.trunc(lines));
  const accessibleLabel = label ?? t.shared.feedback.loading;

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={["ui-skeleton", className].filter(Boolean).join(" ")}
      data-variant={variant}
      role="status"
    >
      <span className="ui-visually-hidden">{accessibleLabel}</span>
      <span aria-hidden="true" className="ui-skeleton__bars">
        {Array.from({ length: barCount }, (_, index) => (
          <span className="ui-skeleton__bar" key={index} />
        ))}
      </span>
    </div>
  );
}

export default Skeleton;
