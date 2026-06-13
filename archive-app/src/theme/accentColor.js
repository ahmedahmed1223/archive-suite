/**
 * Accent color token definitions and application helper.
 *
 * Each preset ships an 11-stop oklch palette (matching Tailwind v4's emerald
 * series format) so that overriding --va-accent-* also updates every
 * --color-emerald-* variable defined in design-tokens.css — which means ALL
 * bg-emerald-*, text-emerald-*, and border-emerald-* Tailwind classes across
 * the app follow the accent picker with zero component changes.
 *
 * Values are pre-computed oklch strings so the browser never has to convert
 * from hex at runtime, and color-mix() chains stay short.
 */

/**
 * Full 11-stop oklch palette for each accent preset.
 * Stops 50–950 mirror Tailwind v4's standard palette geometry:
 *   50 = near-white tint, 950 = near-black shade, 500 = mid-saturation base.
 */
export const ACCENT_PALETTES = {
  emerald: {
    50:  "oklch(97.9% 0.021 166.113)",
    100: "oklch(95%   0.052 163.051)",
    200: "oklch(90.5% 0.093 164.15)",
    300: "oklch(84.5% 0.143 164.978)",
    400: "oklch(76.5% 0.177 163.223)",
    500: "oklch(69.6% 0.17  162.48)",
    600: "oklch(59.6% 0.145 163.225)",
    700: "oklch(50.8% 0.118 165.612)",
    800: "oklch(43.2% 0.095 166.913)",
    900: "oklch(37.8% 0.077 168.94)",
    950: "oklch(26.2% 0.051 172.552)",
    // Legacy semantic tokens (kept for backward-compat with --app-accent usages)
    accent: "#059669",
    strong: "#047857",
    soft:   "#063b32",
  },
  teal: {
    50:  "oklch(98.2% 0.019 196.0)",
    100: "oklch(95.3% 0.05  196.0)",
    200: "oklch(89.4% 0.096 196.0)",
    300: "oklch(82.4% 0.14  196.0)",
    400: "oklch(73.8% 0.162 196.0)",
    500: "oklch(65.4% 0.15  196.0)",
    600: "oklch(55.1% 0.126 196.0)",
    700: "oklch(46.7% 0.101 196.0)",
    800: "oklch(39.4% 0.08  196.0)",
    900: "oklch(33.7% 0.064 196.0)",
    950: "oklch(23.8% 0.042 196.0)",
    accent: "#0d9488",
    strong: "#0f766e",
    soft:   "#0f3f3b",
  },
  indigo: {
    50:  "oklch(96.3% 0.018 272.0)",
    100: "oklch(92.5% 0.051 272.0)",
    200: "oklch(85.0% 0.1   272.0)",
    300: "oklch(76.0% 0.152 272.0)",
    400: "oklch(66.8% 0.19  272.0)",
    500: "oklch(58.6% 0.21  272.0)",
    600: "oklch(51.0% 0.21  272.0)",
    700: "oklch(44.4% 0.19  272.0)",
    800: "oklch(37.7% 0.157 272.0)",
    900: "oklch(32.7% 0.128 272.0)",
    950: "oklch(22.5% 0.088 272.0)",
    accent: "#5b5fc7",
    strong: "#4338ca",
    soft:   "#27275f",
  },
  blue: {
    50:  "oklch(97.0% 0.013 236.6)",
    100: "oklch(93.3% 0.04  239.6)",
    200: "oklch(87.1% 0.085 238.1)",
    300: "oklch(79.0% 0.136 237.6)",
    400: "oklch(70.7% 0.165 254.6)",
    500: "oklch(62.3% 0.214 259.8)",
    600: "oklch(54.6% 0.215 263.4)",
    700: "oklch(48.8% 0.196 264.4)",
    800: "oklch(42.4% 0.161 265.1)",
    900: "oklch(37.9% 0.137 265.5)",
    950: "oklch(28.5% 0.109 267.0)",
    accent: "#2563eb",
    strong: "#1d4ed8",
    soft:   "#172554",
  },
  slate: {
    50:  "oklch(98.4% 0.003 247.9)",
    100: "oklch(96.8% 0.007 247.9)",
    200: "oklch(93.0% 0.013 255.5)",
    300: "oklch(87.2% 0.02  258.3)",
    400: "oklch(70.4% 0.04  256.8)",
    500: "oklch(55.4% 0.046 257.4)",
    600: "oklch(44.6% 0.043 257.2)",
    700: "oklch(37.2% 0.034 259.7)",
    800: "oklch(27.9% 0.022 261.3)",
    900: "oklch(20.8% 0.042 265.8)",
    950: "oklch(12.9% 0.042 264.7)",
    accent: "#475569",
    strong: "#334155",
    soft:   "#1e293b",
  },
  purple: {
    50:  "oklch(97.7% 0.014 308.3)",
    100: "oklch(94.6% 0.033 307.5)",
    200: "oklch(89.1% 0.071 308.5)",
    300: "oklch(82.7% 0.118 309.6)",
    400: "oklch(75.4% 0.162 311.9)",
    500: "oklch(66.8% 0.212 316.3)",
    600: "oklch(56.8% 0.223 318.5)",
    700: "oklch(49.6% 0.207 318.9)",
    800: "oklch(43.8% 0.182 319.1)",
    900: "oklch(38.1% 0.153 319.5)",
    950: "oklch(25.5% 0.106 320.5)",
    accent: "#7c3aed",
    strong: "#6d28d9",
    soft:   "#2e1065",
  },
  amber: {
    50:  "oklch(98.7% 0.022 95.3)",
    100: "oklch(96.3% 0.059 95.6)",
    200: "oklch(92.4% 0.112 95.3)",
    300: "oklch(86.4% 0.167 89.0)",
    400: "oklch(79.3% 0.189 79.9)",
    500: "oklch(72.3% 0.187 67.2)",
    600: "oklch(62.8% 0.178 56.9)",
    700: "oklch(54.2% 0.164 49.2)",
    800: "oklch(46.6% 0.145 44.2)",
    900: "oklch(40.4% 0.121 40.9)",
    950: "oklch(27.5% 0.079 37.3)",
    accent: "#b45309",
    strong: "#92400e",
    soft:   "#451a03",
  },
  rose: {
    50:  "oklch(97.7% 0.013 17.4)",
    100: "oklch(94.2% 0.035 17.9)",
    200: "oklch(88.4% 0.073 18.5)",
    300: "oklch(81.0% 0.117 19.5)",
    400: "oklch(72.1% 0.163 25.2)",
    500: "oklch(64.3% 0.195 30.9)",
    600: "oklch(58.6% 0.207 16.6)",
    700: "oklch(51.4% 0.195 16.3)",
    800: "oklch(45.5% 0.174 17.2)",
    900: "oklch(40.8% 0.153 17.8)",
    950: "oklch(27.1% 0.104 17.7)",
    accent: "#e11d48",
    strong: "#be123c",
    soft:   "#4c0519",
  },
};

// ── Legacy flat map kept for backward-compat ──────────────────────────────────
export const ACCENT_COLOR_TOKENS = Object.fromEntries(
  Object.entries(ACCENT_PALETTES).map(([key, p]) => [key, { accent: p.accent, strong: p.strong, soft: p.soft }])
);

export function getAccentColorTokens(accentColor = "blue") {
  return ACCENT_COLOR_TOKENS[accentColor] || ACCENT_COLOR_TOKENS.blue;
}

/**
 * Apply an accent preset to the document root.
 *
 * Sets all three layers of tokens:
 *  1. --va-accent-50 … --va-accent-950  (full palette — drives Tailwind overrides)
 *  2. --va-action / --va-action-strong  (semantic aliases used by va-* CSS classes)
 *  3. --app-accent / --color-accent     (legacy aliases)
 */
export function applyAccentColor(accentColor = "teal", root = typeof document !== "undefined" ? document.documentElement : null) {
  const palette = ACCENT_PALETTES[accentColor] || ACCENT_PALETTES.teal;

  if (!root) {
    return { accent: palette.accent, strong: palette.strong, soft: palette.soft };
  }

  // 1. Full palette — overrides --color-emerald-* cascade defined in design-tokens.css
  root.style.setProperty("--va-accent-50",  palette[50]);
  root.style.setProperty("--va-accent-100", palette[100]);
  root.style.setProperty("--va-accent-200", palette[200]);
  root.style.setProperty("--va-accent-300", palette[300]);
  root.style.setProperty("--va-accent-400", palette[400]);
  root.style.setProperty("--va-accent-500", palette[500]);
  root.style.setProperty("--va-accent-600", palette[600]);
  root.style.setProperty("--va-accent-700", palette[700]);
  root.style.setProperty("--va-accent-800", palette[800]);
  root.style.setProperty("--va-accent-900", palette[900]);
  root.style.setProperty("--va-accent-950", palette[950]);

  // 2. Semantic aliases (used by va-* classes in v1-identity.css)
  root.style.setProperty("--va-v1-accent",        palette.accent);
  root.style.setProperty("--va-v1-accent-strong",  palette.strong);
  root.style.setProperty("--va-v1-accent-soft",    palette.soft);

  // 3. Legacy aliases
  root.style.setProperty("--app-accent",   palette.accent);
  root.style.setProperty("--color-accent", palette.accent);

  return { accent: palette.accent, strong: palette.strong, soft: palette.soft };
}
