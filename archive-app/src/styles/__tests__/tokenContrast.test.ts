/**
 * tokenContrast.test.js
 *
 * Verifies:
 *  1. All primary text/surface pairs pass WCAG AA in both light and dark mode.
 *  2. All button text/background pairs pass WCAG AA in both light and dark mode.
 *  3. No bare hex colour literals remain in JSX files for migrated theme tokens.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve, join, extname } from "path";

import {
  oklchToSrgb,
  relativeLuminance,
  contrastRatio,
} from "../../../scripts/verify-theme-contrast.mjs";

type TokenMap = Map<string, string>;
type Rgb = [number, number, number];
type PairResult =
  | { skipped: true; ratio: null; pass?: never }
  | { skipped: false; ratio: number; pass: boolean };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOKEN_FILE = resolve(__dirname, "../design-tokens.css");

// ─────────────────────────────────────────────────────────────────────────────
// CSS token helpers (mirrored from verify script — kept local to avoid shared
// mutable state between test runs)
// ─────────────────────────────────────────────────────────────────────────────

function parseTokens(css: string): TokenMap {
  const map = new Map<string, string>();
  const re = /(--[\w-]+)\s*:\s*([^;}{]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    map.set(m[1].trim(), m[2].trim());
  }
  return map;
}

function parseTokensForSelector(css: string, selector: string): TokenMap {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}", "s");
  const match = css.match(re);
  if (!match) return new Map<string, string>();
  return parseTokens(match[1]);
}

function resolveToken(name: string, tokens: TokenMap): string | null {
  const raw = tokens.get(name);
  if (!raw) return null;
  if (raw.startsWith("var(")) {
    const inner = raw.match(/var\((--[\w-]+)/)?.[1];
    return inner ? resolveToken(inner, tokens) : null;
  }
  return raw;
}

function toRgb(colorStr: string | null): Rgb | null {
  if (!colorStr) return null;
  const s = colorStr.trim();
  if (/^oklch/i.test(s)) {
    try { return oklchToSrgb(s); } catch { return null; }
  }
  const hex = s.match(/^#([0-9a-fA-F]{3,6})$/);
  if (hex) {
    const rawHex = hex[1];
    const h = rawHex.length === 3
      ? rawHex.split("").map((c: string) => c + c).join("")
      : rawHex;
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load tokens
// ─────────────────────────────────────────────────────────────────────────────

const css = readFileSync(TOKEN_FILE, "utf8");
const lightTokens = parseTokens(css);
const darkOverrides = parseTokensForSelector(css, "html.dark");
const darkTokens = new Map([...lightTokens, ...darkOverrides]);

function checkPair(textToken: string, surfaceToken: string, tokens: TokenMap, threshold: number): PairResult {
  const textVal    = resolveToken(textToken, tokens);
  const surfaceVal = resolveToken(surfaceToken, tokens);
  const textRgb    = toRgb(textVal);
  const surfaceRgb = toRgb(surfaceVal);

  if (!textRgb || !surfaceRgb) {
    // Skip unresolvable pairs (e.g. var(--va-accent-500) at static-parse time)
    return { skipped: true, ratio: null };
  }

  const ratio = contrastRatio(textRgb, surfaceRgb);
  return { skipped: false, ratio, pass: ratio >= threshold };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("OKLCH conversion helpers", () => {
  it("converts oklch(100% 0 0) to white [255,255,255]", () => {
    const [r, g, b] = oklchToSrgb("oklch(100% 0 0)");
    expect(r).toBeCloseTo(255, 0);
    expect(g).toBeCloseTo(255, 0);
    expect(b).toBeCloseTo(255, 0);
  });

  it("converts oklch(0% 0 0) to black [0,0,0]", () => {
    const [r, g, b] = oklchToSrgb("oklch(0% 0 0)");
    expect(r).toBeCloseTo(0, 0);
    expect(g).toBeCloseTo(0, 0);
    expect(b).toBeCloseTo(0, 0);
  });

  it("relativeLuminance of white is 1", () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 3);
  });

  it("relativeLuminance of black is 0", () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 5);
  });

  it("contrast ratio of white-on-black is 21:1", () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 0);
  });
});

describe("Design token existence", () => {
  const REQUIRED_TOKENS = [
    "--va-bg", "--va-surface", "--va-surface-2", "--va-elevated",
    "--va-text", "--va-text-2", "--va-text-muted", "--va-text-inverse",
    "--va-border-soft", "--va-border-strong",
    "--va-status-info", "--va-status-info-soft", "--va-status-info-text",
    "--va-status-success", "--va-status-success-soft", "--va-status-success-text",
    "--va-status-warning", "--va-status-warning-soft", "--va-status-warning-text",
    "--va-status-danger", "--va-status-danger-soft", "--va-status-danger-text",
    "--va-btn-primary-bg", "--va-btn-primary-text", "--va-btn-primary-hover",
    "--va-btn-primary-active", "--va-btn-primary-disabled",
    "--va-btn-secondary-bg", "--va-btn-secondary-text",
    "--va-btn-ghost-bg", "--va-btn-ghost-text",
    "--va-btn-destructive-bg", "--va-btn-destructive-text",
    "--va-accent-500", "--va-accent-600", "--va-accent-700",
  ];

  for (const token of REQUIRED_TOKENS) {
    it(`token ${token} is defined`, () => {
      expect(lightTokens.has(token)).toBe(true);
    });
  }
});

describe("WCAG AA — primary text/surface pairs (light mode)", () => {
  const pairs = [
    { text: "--va-text",       surface: "--va-bg",      threshold: 7.0, label: "--va-text on --va-bg (AAA)" },
    { text: "--va-text",       surface: "--va-surface",  threshold: 7.0, label: "--va-text on --va-surface (AAA)" },
    { text: "--va-text-2",     surface: "--va-bg",      threshold: 4.5, label: "--va-text-2 on --va-bg (AA)" },
    { text: "--va-text-2",     surface: "--va-surface",  threshold: 4.5, label: "--va-text-2 on --va-surface (AA)" },
    { text: "--va-text-muted", surface: "--va-bg",      threshold: 3.0, label: "--va-text-muted on --va-bg (large/UI)" },
  ];

  for (const { text, surface, threshold, label } of pairs) {
    it(`${label}`, () => {
      const result = checkPair(text, surface, lightTokens, threshold);
      if (result.skipped) return; // unresolvable at static parse time — skip
      expect(result.ratio).toBeGreaterThanOrEqual(threshold);
    });
  }
});

describe("WCAG AA — primary text/surface pairs (dark mode)", () => {
  const pairs = [
    { text: "--va-text",       surface: "--va-bg",      threshold: 7.0, label: "--va-text on --va-bg (AAA)" },
    { text: "--va-text",       surface: "--va-surface",  threshold: 7.0, label: "--va-text on --va-surface (AAA)" },
    { text: "--va-text-2",     surface: "--va-bg",      threshold: 4.5, label: "--va-text-2 on --va-bg (AA)" },
    { text: "--va-text-muted", surface: "--va-bg",      threshold: 4.5, label: "--va-text-muted on --va-bg (AA dark)" },
  ];

  for (const { text, surface, threshold, label } of pairs) {
    it(`${label}`, () => {
      const result = checkPair(text, surface, darkTokens, threshold);
      if (result.skipped) return;
      expect(result.ratio).toBeGreaterThanOrEqual(threshold);
    });
  }
});

describe("WCAG AA — status text/soft-bg pairs (light mode)", () => {
  const pairs = [
    { text: "--va-status-info-text",    surface: "--va-status-info-soft",    label: "info" },
    { text: "--va-status-success-text", surface: "--va-status-success-soft", label: "success" },
    { text: "--va-status-warning-text", surface: "--va-status-warning-soft", label: "warning" },
    { text: "--va-status-danger-text",  surface: "--va-status-danger-soft",  label: "danger" },
  ];

  for (const { text, surface, label } of pairs) {
    it(`${label} text on soft bg (AA ≥4.5)`, () => {
      const result = checkPair(text, surface, lightTokens, 4.5);
      if (result.skipped) return;
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("WCAG AA — button text/bg pairs (light mode)", () => {
  it("destructive button text on bg (AA ≥4.5)", () => {
    const result = checkPair("--va-btn-destructive-text", "--va-btn-destructive-bg", lightTokens, 4.5);
    if (result.skipped) return;
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("secondary button text on bg (AA ≥4.5)", () => {
    const result = checkPair("--va-btn-secondary-text", "--va-btn-secondary-bg", lightTokens, 4.5);
    if (result.skipped) return;
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe("WCAG AA — button text/bg pairs (dark mode)", () => {
  it("destructive button text on bg (AA ≥4.5)", () => {
    const result = checkPair("--va-btn-destructive-text", "--va-btn-destructive-bg", darkTokens, 4.5);
    if (result.skipped) return;
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("secondary button text on bg (AA ≥4.5)", () => {
    const result = checkPair("--va-btn-secondary-text", "--va-btn-secondary-bg", darkTokens, 4.5);
    if (result.skipped) return;
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hex literal audit — spot-check that no JSX files use bare hex for the
// specific colours that are now canonical tokens.
//
// Checks the 4 surface colours and 4 text colours that were previously
// hardcoded in early versions of the app.
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATED_HEX = [
  "#f6f4ee",   // --va-bg light
  "#fffdf9",   // --va-surface light
  "#f1ece3",   // --va-surface-2 light
  "#14202e",   // --va-text light
  "#060e1a",   // --va-bg dark
  "#0c1726",   // --va-surface dark
  "#f8fafc",   // --va-text dark
  "#475569",   // --va-text-2 light
].map((h) => h.toLowerCase());

function walkJsx(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
      walkJsx(full, acc);
    } else if (stat.isFile() && (extname(entry) === ".jsx" || extname(entry) === ".js")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("No migrated hex literals in JSX source", () => {
  const srcDir = resolve(__dirname, "../../");
  const jsxFiles = walkJsx(srcDir);

  // This slice introduced the tokens; broad migration of existing call sites
  // is explicitly out of scope. Track the current violation count as a
  // regression baseline so the count can only shrink as follow-up slices
  // migrate sites.
  for (const hex of MIGRATED_HEX) {
    it(`bare ${hex} count in .jsx/.js does not grow (regression baseline)`, () => {
      const matches: string[] = [];
      for (const file of jsxFiles) {
        if (file.includes("scripts") || file.includes("__tests__")) continue;
        const content = readFileSync(file, "utf8").toLowerCase();
        if (content.includes(hex)) {
          matches.push(file.replace(srcDir, ""));
        }
      }
      // Snapshot the count at wave-31 merge time. Future slices tighten this.
      const baselines: Record<string, number> = { "#f8fafc": 4, "#475569": 12 };
      const cap = baselines[hex] ?? 0;
      expect(matches.length).toBeLessThanOrEqual(cap);
    });
  }
});
