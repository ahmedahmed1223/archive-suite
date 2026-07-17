"use client";

import * as Icons from "lucide-react";
import { useDensity } from "@/lib/use-density";

export default function DensityToggle() {
  const { density, toggleDensity } = useDensity();
  const isCompact = density === "compact";

  return (
    <button
      type="button"
      className="icon-action density-toggle"
      onClick={toggleDensity}
      aria-label={isCompact ? "التبديل إلى تباعد مريح" : "التبديل إلى تباعد مضغوط"}
      title={isCompact ? "تباعد مضغوط (اضغط للتبديل إلى مريح)" : "تباعد مريح (اضغط للتبديل إلى مضغوط)"}
      aria-pressed={isCompact}
    >
      {isCompact ? (
        <Icons.Rows3 aria-hidden="true" size={18} strokeWidth={2} />
      ) : (
        <Icons.Rows2 aria-hidden="true" size={18} strokeWidth={2} />
      )}
      <span className="density-toggle__label">{isCompact ? "مضغوط" : "مريح"}</span>
    </button>
  );
}
