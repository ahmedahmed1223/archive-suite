import type { ReactNode } from "react";

export type SkeletonProps = {
  /** نص يُعلَن لقارئات الشاشة بدل الأشكال الزخرفية. */
  label?: string;
  /** عدد الأسطر الوهمية المعروضة (الحد الأدنى سطر واحد). */
  lines?: number;
  /** "text" أسطر نصية متفاوتة العرض، و"block" مساحة صلبة لبطاقة أو وسائط. */
  variant?: "text" | "block";
  className?: string;
};

const DEFAULT_LABEL = "جار التحميل...";

/**
 * حالة تحميل موحّدة: الأشكال زخرفية ومخفية عن التقنيات المساعدة،
 * والنص البديل وحده يُعلَن عبر منطقة حيّة مهذّبة.
 * وميض الحركة يُعطَّل عبر prefers-reduced-motion في CSS.
 */
export function Skeleton({
  label = DEFAULT_LABEL,
  lines = 3,
  variant = "text",
  className = ""
}: Readonly<SkeletonProps>): ReactNode {
  const barCount = Math.max(1, Math.trunc(lines));

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={["ui-skeleton", className].filter(Boolean).join(" ")}
      data-variant={variant}
      role="status"
    >
      <span className="ui-visually-hidden">{label}</span>
      <span aria-hidden="true" className="ui-skeleton__bars">
        {Array.from({ length: barCount }, (_, index) => (
          <span className="ui-skeleton__bar" key={index} />
        ))}
      </span>
    </div>
  );
}

export default Skeleton;
