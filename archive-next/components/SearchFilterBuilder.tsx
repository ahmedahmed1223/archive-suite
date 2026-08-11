"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const fields = ["title", "description", "type", "subtype", "tag", "store", "status", "uid"] as const;

export default function SearchFilterBuilder({ value, onChange }: Readonly<{ value: string; onChange: (value: string) => void }>) {
  const { t } = useLocale();
  const copy = t.pages.searchResults;
  const [field, setField] = useState<(typeof fields)[number]>("tag");
  const [filterValue, setFilterValue] = useState("");
  const add = () => {
    const trimmed = filterValue.trim();
    if (!trimmed) return;
    const escaped = trimmed.replaceAll('"', '\\"');
    const predicate = `${field}:${/\s/.test(trimmed) ? `"${escaped}"` : escaped}`;
    onChange(value.trim() ? `${value.trim()} AND ${predicate}` : predicate);
    setFilterValue("");
  };
  return <div className="search-filter-builder">
    <label>{copy.filterField}<select value={field} onChange={(event) => setField(event.target.value as typeof field)}>{fields.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label>{copy.filterValue}<input value={filterValue} onChange={(event) => setFilterValue(event.target.value)} /></label>
    <button type="button" className="button button-secondary button-sm" onClick={add}>{copy.addFilter}</button>
  </div>;
}
