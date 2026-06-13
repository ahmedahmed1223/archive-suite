export function csvEscape(value) {
  if (value === void 0 || value === null) return "";
  const text = Array.isArray(value)
    ? value.join("، ")
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function rowsToCsv(rows = []) {
  if (!rows.length) return "لا توجد بيانات\n";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
}
