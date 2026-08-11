"use client";

import { useMemo, useState } from "react";
import { searchIcons } from "@/lib/icon-catalog";
import { resolveIcon } from "@/lib/icon-registry";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = {
  value?: string;
  onChange: (iconName: string) => void;
  label?: string;
};

export default function IconPicker({ value, onChange, label }: Props) {
  const { t } = useLocale();
  const copy = t.shared.iconPicker;
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchIcons(query), [query]);

  return (
    <div className="icon-picker">
      <input
        type="search"
        aria-label={copy.search}
        placeholder={copy.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div
        role="group"
        aria-label={label ?? copy.choose}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(2.5rem, 1fr))",
          gap: "0.5rem",
          marginTop: "0.5rem"
        }}
      >
        {results.map((name) => {
          const Icon = resolveIcon(name);
          const isSelected = name === value;
          return (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={isSelected}
              onClick={() => onChange(name)}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={2} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
