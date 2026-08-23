/**
 * Renders an unknown value for display in a key/value grid, one level deep,
 * instead of dumping the whole thing as raw JSON (V14-AUDIT-010 pattern).
 */
export function formatKvValue(value: unknown, notAvailableLabel: string): string {
  if (value === null || value === undefined || value === "") {
    return notAvailableLabel;
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatKvScalar(item)).join("، ");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => `${key}: ${formatKvScalar(entryValue)}`)
      .join(" · ");
  }

  return String(value);
}

function formatKvScalar(value: unknown): string {
  return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}
