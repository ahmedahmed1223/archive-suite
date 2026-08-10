import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

// V2-604: this cast was copy-pasted identically across 8 files.
export const iconRegistry = Icons as unknown as Record<string, LucideIcon>;

export function resolveIcon(name: string, fallback: LucideIcon = Icons.Circle): LucideIcon {
  return iconRegistry[name] || fallback;
}
