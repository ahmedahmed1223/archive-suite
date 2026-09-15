"use client";

import type { LucideIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface DataViewOption<TValue extends string> {
  value: TValue;
  label: string;
  shortLabel?: string;
  /**
   * V2-DESIGN-002: when given, the button renders icon-only and `label`
   * becomes its accessible name, so a long row of text chips collapses into a
   * compact toggle without dropping any option.
   */
  icon?: LucideIcon;
}

export default function DataViewSwitcher<TValue extends string>({
  value,
  options,
  onChange,
  label
}: Readonly<{
  value: TValue;
  options: readonly DataViewOption<TValue>[];
  onChange: (value: TValue) => void;
  label?: string;
}>) {
  const { t } = useLocale();

  return (
    <div className="view-switcher" role="group" aria-label={label ?? t.shared.dataViewSwitcher.label}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            className="view-switcher__button"
            data-icon-only={Icon ? "true" : "false"}
            aria-pressed={value === option.value}
            aria-label={Icon ? option.label : undefined}
            onClick={() => onChange(option.value)}
            title={option.label}
          >
            {Icon ? (
              <Icon size={16} aria-hidden="true" />
            ) : (
              <span className="view-switcher__label">{option.shortLabel || option.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
