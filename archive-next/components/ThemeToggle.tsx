"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const themeSequence = ["system", "light", "dark"] as const;

export default function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? theme || "system" : "system";
  const nextTheme = themeSequence[(themeSequence.indexOf(currentTheme as (typeof themeSequence)[number]) + 1) % themeSequence.length];
  const label =
    currentTheme === "dark"
      ? "الوضع الداكن"
      : currentTheme === "light"
        ? "الوضع الفاتح"
        : "حسب النظام";
  const Icon = currentTheme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      className="icon-action theme-toggle"
      onClick={() => setTheme(nextTheme)}
      aria-label={`تغيير الثيم: ${label}`}
      title={`الثيم: ${label}`}
      disabled={!mounted}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={2} />
    </button>
  );
}
