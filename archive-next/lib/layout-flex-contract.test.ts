import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// V14-UX-009 (Task 9): flexible-layout and direction contract for the shared
// stylesheets. Physical `left/right` alignment breaks under RTL/LTR switching,
// so the shared cascade must use logical properties; interactive rows must
// wrap rather than compress on phones.

const stylesDir = path.resolve("app/styles");

const SHARED_STYLESHEETS = [
  "01-base.css",
  "02-layout.css",
  "03-components.css",
  "04-tables.css",
  "05-status.css",
  "06-widgets.css",
  "07-ui-kit.css",
  "08-foundation.css",
] as const;

function cssFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".css")) out.push(full);
    }
  }
  walk(stylesDir);
  return out;
}

describe("flexible layout and direction contract", () => {
  it("shared stylesheets use logical properties instead of physical left/right", () => {
    const offenders: string[] = [];
    for (const name of SHARED_STYLESHEETS) {
      const source = readFileSync(path.join(stylesDir, name), "utf8");
      // Match declarations like `left:`, `right:`, `margin-left:`,
      // `padding-right:` — but not comments or `text-align`.
      const pattern = /(?:^|[^-–\w])(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/gm;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        offenders.push(`${name}: ${match[0].trim()}`);
      }
    }
    expect(offenders, "physical direction properties in shared CSS").toEqual([]);
  });

  it("the page action row wraps instead of compressing on phones", () => {
    const css = readFileSync(path.join(stylesDir, "03-components.css"), "utf8");
    expect(css).toMatch(/\.page-action-row\s*\{[^}]*flex-wrap:\s*wrap/s);
    expect(css).toMatch(/@media \(max-width: 47\.99rem\)\s*\{\s*\.page-action-row[^}]*min-block-size:\s*44px/s);
  });
});
