"use client";

import { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { searchIcons } from "@/lib/icon-catalog";

const iconRegistry = Icons as unknown as Record<string, LucideIcon>;

type Props = {
  value?: string;
  onChange: (iconName: string) => void;
  label?: string;
};

export default function IconPicker({ value, onChange, label = "اختر أيقونة" }: Props) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchIcons(query), [query]);

  return (
    <div className="icon-picker">
      <input
        type="search"
        aria-label="بحث عن أيقونة"
        placeholder="بحث..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div
        role="group"
        aria-label={label}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(2.5rem, 1fr))",
          gap: "0.5rem",
          marginTop: "0.5rem"
        }}
      >
        {results.map((name) => {
          const Icon = iconRegistry[name] || Icons.Circle;
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
