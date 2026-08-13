"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface DataViewOption<TValue extends string> {
  value: TValue;
  label: string;
  shortLabel?: string;
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
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="view-switcher__button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          title={option.label}
        >
          <span className="view-switcher__label">{option.shortLabel || option.label}</span>
        </button>
      ))}
    </div>
  );
}
