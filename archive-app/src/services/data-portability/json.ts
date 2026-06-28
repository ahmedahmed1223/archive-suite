export function safeJsonParse<T>(text: string, fallback: T, options: { onError?: (error: unknown) => void } = {}): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    if (typeof options.onError === "function") options.onError(error);
    return fallback;
  }
}

export function sanitizePlainData(value: any, seen: WeakSet<object> = new WeakSet<object>()): any {
  if (value === null || value === void 0) return value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizePlainData(item, seen));
  const clean: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (typeof child === "function" || child === void 0) continue;
    clean[key] = sanitizePlainData(child, seen);
  }
  return clean;
}
