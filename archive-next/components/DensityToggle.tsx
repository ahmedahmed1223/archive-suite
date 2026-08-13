"use client";

import * as Icons from "lucide-react";
import { useDensity } from "@/lib/use-density";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function DensityToggle() {
  const { t } = useLocale();
  const copy = t.shell.density;
  const { density, toggleDensity } = useDensity();
  const isCompact = density === "compact";

  return (
    <button
      type="button"
      className="icon-action density-toggle"
      onClick={toggleDensity}
      aria-label={isCompact ? copy.switchToComfortable : copy.switchToCompact}
      title={isCompact ? copy.compactTitle : copy.comfortableTitle}
      aria-pressed={isCompact}
    >
      {isCompact ? (
        <Icons.Rows3 aria-hidden="true" size={18} strokeWidth={2} />
      ) : (
        <Icons.Rows2 aria-hidden="true" size={18} strokeWidth={2} />
      )}
      <span className="density-toggle__label">{isCompact ? copy.compact : copy.comfortable}</span>
    </button>
  );
}
