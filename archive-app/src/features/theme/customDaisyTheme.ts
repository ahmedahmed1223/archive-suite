// @ts-nocheck
export const CUSTOM_DAISY_THEME_STORAGE_KEY = "videoArchive:customDaisyTheme";

export const CUSTOM_DAISY_THEME_FIELDS = Object.freeze([
  { key: "--color-base-100", label: "الخلفية", defaultValue: "#0b1626" },
  { key: "--color-base-200", label: "السطح", defaultValue: "#142033" },
  { key: "--color-base-300", label: "السطح المرتفع", defaultValue: "#1f2a44" },
  { key: "--color-base-content", label: "النص", defaultValue: "#f8fafc" },
  { key: "--color-primary", label: "أساسي", defaultValue: "#14b8a6" },
  { key: "--color-primary-content", label: "نص الأساسي", defaultValue: "#042f2e" },
  { key: "--color-secondary", label: "ثانوي", defaultValue: "#4f46e5" },
  { key: "--color-secondary-content", label: "نص الثانوي", defaultValue: "#eef2ff" },
  { key: "--color-accent", label: "تمييز", defaultValue: "#22d3ee" },
  { key: "--color-accent-content", label: "نص التمييز", defaultValue: "#083344" },
  { key: "--color-neutral", label: "محايد", defaultValue: "#111827" },
  { key: "--color-neutral-content", label: "نص محايد", defaultValue: "#f9fafb" },
  { key: "--color-info", label: "معلومة", defaultValue: "#38bdf8" },
  { key: "--color-success", label: "نجاح", defaultValue: "#22c55e" },
  { key: "--color-warning", label: "تحذير", defaultValue: "#f59e0b" },
  { key: "--color-error", label: "خطأ", defaultValue: "#ef4444" },
  { key: "--color-bg-primary", label: "خلفية التطبيق", defaultValue: "#0b1626" },
  { key: "--color-bg-surface", label: "سطح التطبيق", defaultValue: "#142033" },
  { key: "--color-bg-elevated", label: "سطح عائم", defaultValue: "#1f2a44" },
  { key: "--color-text-primary", label: "نص التطبيق", defaultValue: "#f8fafc" },
  { key: "--color-text-secondary", label: "نص ثانوي", defaultValue: "#cbd5e1" },
  { key: "--color-text-muted", label: "نص خافت", defaultValue: "#94a3b8" },
  { key: "--color-border", label: "حدود", defaultValue: "#334155" },
]);

export const CUSTOM_DAISY_THEME_KEYS = CUSTOM_DAISY_THEME_FIELDS.map((field) => field.key);

export const DEFAULT_CUSTOM_DAISY_THEME = Object.freeze({
  enabled: false,
  name: "سمة مخصصة",
  vars: Object.freeze(Object.fromEntries(CUSTOM_DAISY_THEME_FIELDS.map((field) => [field.key, field.defaultValue]))),
});

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function normalizeHex(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((ch) => ch + ch).join("")}`.toLowerCase();
  }
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

export function normalizeCustomDaisyTheme(value) {
  const input = value && typeof value === "object" ? value : {};
  const inputVars = input.vars && typeof input.vars === "object" ? input.vars : {};
  const vars = {};
  for (const field of CUSTOM_DAISY_THEME_FIELDS) {
    vars[field.key] = normalizeHex(inputVars[field.key], field.defaultValue);
  }
  return {
    enabled: input.enabled === true,
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 40) : DEFAULT_CUSTOM_DAISY_THEME.name,
    vars,
  };
}

export function getStoredCustomDaisyTheme(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const raw = storage?.getItem?.(CUSTOM_DAISY_THEME_STORAGE_KEY);
    return normalizeCustomDaisyTheme(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeCustomDaisyTheme(null);
  }
}

export function storeCustomDaisyTheme(value, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  const normalized = normalizeCustomDaisyTheme(value);
  try {
    storage?.setItem?.(CUSTOM_DAISY_THEME_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Inline CSS variables remain the source of immediate truth.
  }
  return normalized;
}

export function clearCustomDaisyThemeVars(root = typeof document !== "undefined" ? document.documentElement : null) {
  if (!root?.style) return;
  for (const key of CUSTOM_DAISY_THEME_KEYS) {
    root.style.removeProperty(key);
  }
}

export function applyCustomDaisyTheme(value, root = typeof document !== "undefined" ? document.documentElement : null) {
  const normalized = normalizeCustomDaisyTheme(value);
  if (!root?.style) return normalized;
  clearCustomDaisyThemeVars(root);
  if (!normalized.enabled) return normalized;
  for (const key of CUSTOM_DAISY_THEME_KEYS) {
    root.style.setProperty(key, normalized.vars[key]);
  }
  return normalized;
}

