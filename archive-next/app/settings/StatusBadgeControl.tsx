import { AlertTriangle, CheckCircle2, Info, MinusCircle, XCircle } from "lucide-react";

export type StatusBadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

// ponytail: icons chosen for distinct outline shape (circle+check, triangle,
// circle+x, circle+i, circle+dash) so tone never relies on color alone.
const STATUS_BADGE_ICONS: Record<StatusBadgeTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  neutral: MinusCircle
};

const STATUS_BADGE_CLASS: Record<StatusBadgeTone, string> = {
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  neutral: ""
};

export function StatusBadge({ children, tone = "neutral" }: Readonly<{ children: string; tone?: StatusBadgeTone }>) {
  const Icon = STATUS_BADGE_ICONS[tone];
  return (
    <span className={`badge status-badge ${STATUS_BADGE_CLASS[tone]}`.trim()} data-tone={tone}>
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  );
}
