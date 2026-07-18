"use client";

import { useState } from "react";

const fields = ["title", "description", "type", "subtype", "tag", "store", "status", "uid"] as const;

export default function SearchFilterBuilder({ value, onChange }: Readonly<{ value: string; onChange: (value: string) => void }>) {
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
    <label>حقل الفلتر<select value={field} onChange={(event) => setField(event.target.value as typeof field)}>{fields.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label>قيمة الفلتر<input value={filterValue} onChange={(event) => setFilterValue(event.target.value)} /></label>
    <button type="button" className="button button-secondary button-sm" onClick={add}>إضافة فلتر</button>
  </div>;
}
