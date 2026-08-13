import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Arabic letters only: punctuation such as `،` is valid in technical strings and does not prove UI copy.
const ARABIC_TEXT = /[\u0621-\u063A\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06FA-\u06FC\u06FF]/;
const SOURCE_ROOTS = ["app", "components"];

// Locale-aware API payloads; not browser UI copy.
// Search-normalization regex; Arabic characters are data, not UI copy.
const ALLOWED_PATHS = new Set(["app/api/guide/route.ts", "app/api/v1/[...path]/route.ts", "app/archive/page.tsx"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("Arabic UI literal regression guard (V2-305)", () => {
  it("keeps browser UI copy in dictionaries instead of app/components source", () => {
    const offenders = SOURCE_ROOTS.flatMap((root) => sourceFiles(join(process.cwd(), root)))
      .map((path) => ({ path: relative(process.cwd(), path).replaceAll("\\", "/"), text: readFileSync(path, "utf8") }))
      .filter(({ path, text }) => !ALLOWED_PATHS.has(path) && ARABIC_TEXT.test(text))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});
