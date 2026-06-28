// @ts-nocheck
export const DAISY_THEME_STORAGE_KEY = "videoArchive:daisyTheme";
export const DEFAULT_DAISY_THEME = "business";

export const DAISY_THEME_OPTIONS = [
  { id: "business", label: "Business", tone: "تشغيلي داكن", bg: "#1c1c1c", fg: "#f5f5f5", accent: "#1c4ed8" },
  { id: "corporate", label: "Corporate", tone: "نهاري مؤسسي", bg: "#ffffff", fg: "#18181b", accent: "#4b6bfb" },
  { id: "emerald", label: "Emerald", tone: "نهاري هادئ", bg: "#ffffff", fg: "#1f2937", accent: "#66cc8a" },
  { id: "nord", label: "Nord", tone: "بارد ومقروء", bg: "#eceff4", fg: "#2e3440", accent: "#5e81ac" },
  { id: "dim", label: "Dim", tone: "داكن منخفض الوهج", bg: "#1f2937", fg: "#d1d5db", accent: "#9ca3af" },
  { id: "night", label: "Night", tone: "داكن عميق", bg: "#0f172a", fg: "#e5e7eb", accent: "#38bdf8" },
  { id: "winter", label: "Winter", tone: "فاتح بارد", bg: "#f8fafc", fg: "#0f172a", accent: "#047aff" },
  { id: "lofi", label: "Lofi", tone: "أبيض وأسود", bg: "#ffffff", fg: "#000000", accent: "#808080" },
  { id: "silk", label: "Silk", tone: "ناعم فاتح", bg: "#faf7f5", fg: "#2b2b2b", accent: "#9f7aea" },
  { id: "caramellatte", label: "Caramellatte", tone: "دافئ فاتح", bg: "#fff7ed", fg: "#2f1b12", accent: "#d97706" },
  { id: "garden", label: "Garden", tone: "طبيعي فاتح", bg: "#e9e7e7", fg: "#100f0f", accent: "#5c7f67" },
  { id: "forest", label: "Forest", tone: "أخضر داكن", bg: "#171212", fg: "#e5e7eb", accent: "#1eb854" },
  { id: "black", label: "Black", tone: "أسود عالي التباين", bg: "#000000", fg: "#ffffff", accent: "#333333" },
  { id: "luxury", label: "Luxury", tone: "داكن فاخر", bg: "#09090b", fg: "#dca54c", accent: "#ffffff" },
  { id: "dracula", label: "Dracula", tone: "داكن ملوّن", bg: "#282a36", fg: "#f8f8f2", accent: "#ff79c6" },
  { id: "synthwave", label: "Synthwave", tone: "نيون داكن", bg: "#2d1b69", fg: "#f9f7fd", accent: "#e779c1" },
  { id: "cyberpunk", label: "Cyberpunk", tone: "تحذيري ساطع", bg: "#ffee00", fg: "#111111", accent: "#ff7598" },
  { id: "aqua", label: "Aqua", tone: "بحري داكن", bg: "#193549", fg: "#e0f2fe", accent: "#2dd4bf" },
  { id: "acid", label: "Acid", tone: "ساطع تجريبي", bg: "#fafafa", fg: "#111111", accent: "#ff00f4" },
  { id: "lemonade", label: "Lemonade", tone: "أصفر هادئ", bg: "#ffffff", fg: "#1f2937", accent: "#facc15" },
  { id: "cupcake", label: "Cupcake", tone: "فاتح لطيف", bg: "#faf7f5", fg: "#291334", accent: "#65c3c8" },
  { id: "bumblebee", label: "Bumblebee", tone: "أصفر عملي", bg: "#ffffff", fg: "#181830", accent: "#e0a82e" },
  { id: "retro", label: "Retro", tone: "ورقي قديم", bg: "#e4d8b4", fg: "#282425", accent: "#ef9995" },
  { id: "valentine", label: "Valentine", tone: "وردي فاتح", bg: "#f0d6e8", fg: "#632c3b", accent: "#e96d7b" },
  { id: "halloween", label: "Halloween", tone: "برتقالي داكن", bg: "#212121", fg: "#f28c18", accent: "#6d3a9c" },
  { id: "pastel", label: "Pastel", tone: "ناعم متعدد", bg: "#ffffff", fg: "#1f2937", accent: "#d1c1d7" },
  { id: "fantasy", label: "Fantasy", tone: "فاتح ملون", bg: "#ffffff", fg: "#1f2937", accent: "#6e0b75" },
  { id: "wireframe", label: "Wireframe", tone: "هيكلي بسيط", bg: "#ffffff", fg: "#111111", accent: "#bbbbbb" },
  { id: "cmyk", label: "CMYK", tone: "طباعة فاتحة", bg: "#ffffff", fg: "#111111", accent: "#45aeee" },
  { id: "autumn", label: "Autumn", tone: "خريفي دافئ", bg: "#f2f2f2", fg: "#1f2937", accent: "#8c0327" },
  { id: "coffee", label: "Coffee", tone: "بني داكن", bg: "#20161f", fg: "#ddcfc1", accent: "#db924b" },
  { id: "abyss", label: "Abyss", tone: "أزرق عميق", bg: "#000617", fg: "#e5e7eb", accent: "#38bdf8" },
  { id: "light", label: "Light", tone: "DaisyUI فاتح", bg: "#ffffff", fg: "#1f2937", accent: "#570df8" },
  { id: "dark", label: "Dark", tone: "DaisyUI داكن", bg: "#1d232a", fg: "#a6adbb", accent: "#661ae6" }
];

export function normalizeDaisyTheme(value) {
  return DAISY_THEME_OPTIONS.some((theme) => theme.id === value) ? value : DEFAULT_DAISY_THEME;
}

export function getStoredDaisyTheme(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    return normalizeDaisyTheme(storage?.getItem?.(DAISY_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_DAISY_THEME;
  }
}

export function storeDaisyTheme(value, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  const normalized = normalizeDaisyTheme(value);
  try {
    storage?.setItem?.(DAISY_THEME_STORAGE_KEY, normalized);
  } catch {
    // The live data-theme attribute remains the source of immediate truth.
  }
  return normalized;
}

// ── Native theme engine ──────────────────────────────────────────────────────
// Maps each preset's seed colors {bg, fg, accent} onto the app's own --va-*
// design tokens via color-mix, so selecting a theme drives the real (re-skinned)
// UI directly — independently of any component library. This is what lets the
// theme presets survive DaisyUI removal as a native color-customization feature.

const THEME_BY_ID = Object.fromEntries(DAISY_THEME_OPTIONS.map((t) => [t.id, t]));

function isDarkHex(hex) {
  const h = String(hex || "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

const mix = (a, b, pct) => `color-mix(in oklab, ${a}, ${b} ${pct}%)`;

/**
 * Apply a preset's palette to the live --va-* tokens. Inline styles on :root
 * beat the stylesheet's light/dark blocks, so the preset fully controls colors
 * regardless of the html.dark class (which we still toggle to keep scrollbars
 * and other html.dark-scoped CSS aligned).
 */
export function applyThemeTokens(themeId, root = typeof document !== "undefined" ? document.documentElement : null) {
  if (!root) return;
  const t = THEME_BY_ID[themeId] || THEME_BY_ID[DEFAULT_DAISY_THEME];
  if (!t) return;
  const { bg, fg, accent } = t;
  const dark = isDarkHex(bg);
  const lift = dark ? fg : "#ffffff"; // direction toward "elevated" surfaces
  const s = root.style;
  s.setProperty("--va-bg", bg);
  s.setProperty("--va-surface", mix(bg, lift, 5));
  s.setProperty("--va-surface-2", mix(bg, lift, 11));
  s.setProperty("--va-elevated", mix(bg, lift, 8));
  s.setProperty("--va-overlay", mix(bg, lift, 8));
  s.setProperty("--va-border-soft", mix("transparent", fg, 12));
  s.setProperty("--va-border-strong", mix("transparent", fg, 20));
  s.setProperty("--va-text", fg);
  s.setProperty("--va-text-2", mix(bg, fg, 78));
  s.setProperty("--va-text-muted", mix(bg, fg, 52));
  s.setProperty("--va-text-inverse", bg);
  // Accent → drive the --va-accent-* ramp (emerald utilities map to it) + v1 aliases.
  s.setProperty("--va-accent-300", mix(accent, "#ffffff", 30));
  s.setProperty("--va-accent-400", mix(accent, "#ffffff", 14));
  s.setProperty("--va-accent-500", accent);
  s.setProperty("--va-accent-600", mix(accent, "#000000", 12));
  s.setProperty("--va-accent-700", mix(accent, "#000000", 26));
  s.setProperty("--va-accent-800", mix(accent, "#000000", 40));
  s.setProperty("--va-v1-accent", accent);
  s.setProperty("--va-v1-accent-strong", mix(accent, "#000000", 18));
  s.setProperty("--va-v1-accent-soft", mix(bg, accent, 16));
  s.setProperty("--color-accent", accent);
  root.classList.toggle("dark", dark);
  s.colorScheme = dark ? "dark" : "light";
}

export function applyDaisyTheme(value, root = typeof document !== "undefined" ? document.documentElement : null) {
  const normalized = normalizeDaisyTheme(value);
  if (root) {
    root.setAttribute("data-theme", normalized);
    applyThemeTokens(normalized, root);
  }
  return normalized;
}

