/**
 * verify-theme-contrast.mjs
 *
 * Reads design-tokens.css, resolves OKLCH colour values, computes WCAG 2.x
 * contrast ratios for declared text/surface pairs, and exits non-zero if any
 * required pair fails its threshold.
 *
 * Zero external dependencies — pure Node.js ESM.
 *
 * Usage:
 *   node scripts/verify-theme-contrast.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOKEN_FILE = resolve(__dirname, "../src/styles/design-tokens.css");

// ─────────────────────────────────────────────────────────────────────────────
// OKLCH → sRGB conversion
//
// Based on Björn Ottosson's published OKLab/OKLCH spec:
//   https://bottosson.github.io/posts/oklab/
//
// Pipeline: OKLCH → OKLab → linear sRGB → gamma-corrected sRGB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert OKLCH to linear-light sRGB [0..1] (may be out-of-gamut).
 * @param {number} L  — lightness   0..1
 * @param {number} C  — chroma      0..∞  (typical 0..0.4)
 * @param {number} H  — hue degrees 0..360
 * @returns {[number, number, number]} linear sRGB [r, g, b]
 */
function oklchToLinearSrgb(L, C, H) {
  // OKLCH → OKLab
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  // OKLab → LMS (cube root space)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  // Cube
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS → linear sRGB
  const r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bv = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return [r, g, bv];
}

/**
 * Apply sRGB gamma (IEC 61966-2-1).
 * @param {number} v — linear component
 * @returns {number} gamma-corrected component
 */
function linearToGamma(v) {
  const c = Math.max(0, Math.min(1, v));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * OKLCH string → sRGB [0..255].
 * Accepts:  "oklch(65.4% 0.15 196.0)"
 * @param {string} str
 * @returns {[number,number,number]} [r,g,b] in 0–255
 */
export function oklchToSrgb(str) {
  const m = str
    .replace(/oklch\s*\(/i, "")
    .replace(")", "")
    .trim()
    .split(/[\s,]+/)
    .map((t) => t.replace("%", "").trim());

  if (m.length < 3) throw new Error(`Cannot parse OKLCH: ${str}`);

  const L = parseFloat(m[0]) / 100;
  const C = parseFloat(m[1]);
  const H = parseFloat(m[2]) || 0;

  const [lr, lg, lb] = oklchToLinearSrgb(L, C, H);
  return [
    Math.round(linearToGamma(lr) * 255),
    Math.round(linearToGamma(lg) * 255),
    Math.round(linearToGamma(lb) * 255),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// WCAG 2.x relative luminance + contrast ratio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute relative luminance from sRGB 0–255 triple.
 * WCAG 2.2 formula: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 */
export function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * WCAG contrast ratio between two sRGB triples.
 * @returns {number} e.g. 4.5
 */
export function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(...rgb1);
  const l2 = relativeLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS token parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all --custom-property: value; pairs from a flat CSS string.
 * Handles multi-line values by iterating declaration blocks.
 * @param {string} css
 * @returns {Map<string, string>}
 */
function parseTokens(css) {
  const map = new Map();
  // Match --name: value (up to semicolon, no nested blocks)
  const re = /(--[\w-]+)\s*:\s*([^;}{]+);/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const name = m[1].trim();
    const value = m[2].trim();
    // Keep last declaration (dark-mode block overrides are handled separately)
    map.set(name, value);
  }
  return map;
}

/**
 * Extract tokens scoped to a given selector block (e.g. "html.dark").
 */
function parseTokensForSelector(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}", "s");
  const m = css.match(re);
  if (!m) return new Map();
  return parseTokens(m[1]);
}

/**
 * Resolve a CSS token value to a concrete colour string.
 * Handles var() references one level deep.
 */
function resolveToken(name, tokens) {
  const raw = tokens.get(name);
  if (!raw) return null;
  if (raw.startsWith("var(")) {
    const inner = raw.match(/var\((--[\w-]+)/)?.[1];
    if (inner) return resolveToken(inner, tokens);
    return null;
  }
  return raw;
}

/**
 * Parse an OKLCH string into sRGB, or return null if not parseable.
 */
function toRgb(colorStr) {
  if (!colorStr) return null;
  const s = colorStr.trim();
  if (/^oklch/i.test(s)) {
    try { return oklchToSrgb(s); } catch { return null; }
  }
  // Hex shorthand #RGB or #RRGGBB
  const hex = s.match(/^#([0-9a-fA-F]{3,6})$/);
  if (hex) {
    const h = hex[1].length === 3
      ? hex[1].split("").map((c) => c + c).join("")
      : hex[1];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrast pairs to verify
//
// Format: { text, surface, threshold, label }
//  threshold: 4.5 (AA normal), 3.0 (AA large/UI), 7.0 (AAA normal)
// ─────────────────────────────────────────────────────────────────────────────

const PAIRS = [
  // Text on surfaces — light mode
  { text: "--va-text",       surface: "--va-bg",        threshold: 7.0,  label: "--va-text on --va-bg (AAA)" },
  { text: "--va-text",       surface: "--va-surface",   threshold: 7.0,  label: "--va-text on --va-surface (AAA)" },
  { text: "--va-text-2",     surface: "--va-bg",        threshold: 4.5,  label: "--va-text-2 on --va-bg (AA)" },
  { text: "--va-text-2",     surface: "--va-surface",   threshold: 4.5,  label: "--va-text-2 on --va-surface (AA)" },
  { text: "--va-text-muted", surface: "--va-bg",        threshold: 3.0,  label: "--va-text-muted on --va-bg (large/UI)" },

  // Status text on their soft backgrounds — light mode
  { text: "--va-status-info-text",    surface: "--va-status-info-soft",    threshold: 4.5, label: "--va-status-info-text on -soft (AA)" },
  { text: "--va-status-success-text", surface: "--va-status-success-soft", threshold: 4.5, label: "--va-status-success-text on -soft (AA)" },
  { text: "--va-status-warning-text", surface: "--va-status-warning-soft", threshold: 4.5, label: "--va-status-warning-text on -soft (AA)" },
  { text: "--va-status-danger-text",  surface: "--va-status-danger-soft",  threshold: 4.5, label: "--va-status-danger-text on -soft (AA)" },

  // Button text on button bg — light mode (teal default accent)
  { text: "--va-btn-primary-text",      surface: "--va-btn-primary-bg",       threshold: 4.5, label: "--va-btn-primary-text on --va-btn-primary-bg (AA)" },
  { text: "--va-btn-secondary-text",    surface: "--va-btn-secondary-bg",     threshold: 4.5, label: "--va-btn-secondary-text on -bg (AA)" },
  { text: "--va-btn-destructive-text",  surface: "--va-btn-destructive-bg",   threshold: 4.5, label: "--va-btn-destructive-text on -bg (AA)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const css = readFileSync(TOKEN_FILE, "utf8");

  // Light tokens (root block — first :root before html.dark)
  const lightTokens = parseTokens(css);

  // Dark tokens (html.dark block overrides)
  const darkOverrides = parseTokensForSelector(css, "html.dark");
  const darkTokens = new Map([...lightTokens, ...darkOverrides]);

  const COL_LABEL   = 46;
  const COL_RATIO   = 10;
  const COL_THRESH  = 10;
  const COL_STATUS  = 8;

  const header = [
    "Pair".padEnd(COL_LABEL),
    "Mode".padEnd(6),
    "Ratio".padEnd(COL_RATIO),
    "Thresh".padEnd(COL_THRESH),
    "Result".padEnd(COL_STATUS),
  ].join("  ");

  const separator = "─".repeat(header.length);

  console.log("\nArchive Suite — Theme Contrast Verification");
  console.log(separator);
  console.log(header);
  console.log(separator);

  let failures = 0;
  const results = [];

  for (const mode of ["light", "dark"]) {
    const tokens = mode === "light" ? lightTokens : darkTokens;

    for (const pair of PAIRS) {
      const textVal    = resolveToken(pair.text,    tokens);
      const surfaceVal = resolveToken(pair.surface, tokens);

      const textRgb    = toRgb(textVal);
      const surfaceRgb = toRgb(surfaceVal);

      if (!textRgb || !surfaceRgb) {
        results.push({
          label: pair.label,
          mode,
          ratio: null,
          threshold: pair.threshold,
          pass: false,
          note: `SKIP (unresolved: ${!textRgb ? pair.text : pair.surface})`,
        });
        continue;
      }

      const ratio = contrastRatio(textRgb, surfaceRgb);
      const pass  = ratio >= pair.threshold;
      if (!pass) failures++;

      results.push({ label: pair.label, mode, ratio, threshold: pair.threshold, pass });
    }
  }

  for (const r of results) {
    const ratioStr    = r.ratio != null ? r.ratio.toFixed(2) + ":1" : "N/A";
    const threshStr   = r.threshold.toFixed(1) + ":1";
    const statusStr   = r.note ?? (r.pass ? "PASS" : "FAIL");
    const line = [
      r.label.padEnd(COL_LABEL),
      r.mode.padEnd(6),
      ratioStr.padEnd(COL_RATIO),
      threshStr.padEnd(COL_THRESH),
      statusStr.padEnd(COL_STATUS),
    ].join("  ");
    console.log(line);
  }

  console.log(separator);

  const total   = results.filter((r) => r.ratio != null).length;
  const passing = results.filter((r) => r.pass && r.ratio != null).length;
  console.log(`\nResult: ${passing}/${total} pairs passed.`);

  if (failures > 0) {
    console.error(`\nERROR: ${failures} contrast pair(s) failed WCAG AA threshold.\n`);
    process.exit(1);
  } else {
    console.log("\nAll required contrast pairs pass WCAG AA.\n");
  }
}

main();
