"use client";

import { useEffect, useId, useState } from "react";
import type { SearchSuggestion } from "@/lib/archive-api";

export default function SearchAutocomplete({ value, onChange, onSelect, fetchSuggestions, placeholder, className }: Readonly<{
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: SearchSuggestion) => void;
  fetchSuggestions: (query: string) => Promise<SearchSuggestion[]>;
  placeholder?: string;
  className?: string;
}>) {
  const listId = useId();
  const [items, setItems] = useState<SearchSuggestion[]>([]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    let alive = true;
    if (value.trim().length < 2) {
      setItems([]);
      return;
    }
    void fetchSuggestions(value).then((next) => { if (alive) setItems(next); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [fetchSuggestions, value]);

  return <div className="search-autocomplete">
    <input aria-label="اقتراحات البحث" role="combobox" value={value} placeholder={placeholder} className={className} onChange={(event) => onChange(event.target.value)} aria-controls={listId} aria-expanded={items.length > 0} onKeyDown={(event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); setActive((current) => Math.min(current + 1, items.length - 1)); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); }
      if (event.key === "Enter" && items[active]) onSelect(items[active]);
      if (event.key === "Escape") setItems([]);
    }} />
    {items.length > 0 ? <ul id={listId} role="listbox">{items.map((item, index) => <li key={`${item.kind}:${item.value}`} role="option" aria-selected={index === active}><button type="button" onClick={() => onSelect(item)}>{item.label}</button></li>)}</ul> : null}
  </div>;
}
