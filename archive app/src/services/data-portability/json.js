export function safeJsonParse(text, fallback = null, options = {}) {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (typeof options.onError === "function") options.onError(error);
    return fallback;
  }
}

export function sanitizePlainData(value, seen = new WeakSet()) {
  if (value === null || value === void 0) return value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizePlainData(item, seen));
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (typeof child === "function" || child === void 0) continue;
    clean[key] = sanitizePlainData(child, seen);
  }
  return clean;
}
