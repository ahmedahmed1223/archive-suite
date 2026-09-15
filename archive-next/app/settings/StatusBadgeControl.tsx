import { AlertTriangle, CheckCircle2, Info, MinusCircle, XCircle } from "lucide-react";
import { BADGE_TONE_CLASS, type BadgeTone } from "@/lib/badge-tone";

// V2-DESIGN-002: the tone vocabulary and its classes now live in
// lib/badge-tone.ts so lists and detail screens colour statuses identically.
// Kept as an alias so every existing `StatusBadgeTone` import still resolves.
export type StatusBadgeTone = BadgeTone;

// ponytail: icons chosen for distinct outline shape (circle+check, triangle,
// circle+x, circle+i, circle+dash) so tone never relies on color alone.
const STATUS_BADGE_ICONS: Record<StatusBadgeTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  neutral: MinusCircle
};

const STATUS_BADGE_CLASS = BADGE_TONE_CLASS;

export function StatusBadge({ children, tone = "neutral" }: Readonly<{ children: string; tone?: StatusBadgeTone }>) {
  const Icon = STATUS_BADGE_ICONS[tone];
  return (
    <span className={`badge status-badge ${STATUS_BADGE_CLASS[tone]}`.trim()} data-tone={tone}>
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  );
}
