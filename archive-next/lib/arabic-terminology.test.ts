import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  findDeprecatedUiTerms,
  findForbiddenOperationalTerms,
  findForbiddenOperationalTermFindings,
} from "@/lib/arabic-terminology";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_ROOTS = ["app", "components", "lib"];
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const EXCLUDED_SUFFIXES = [".test.ts", ".test.tsx"];
const EXCLUDED_DIRS = new Set(["generated"]);

function listSourceFiles(root: string): string[] {
  const absoluteRoot = join(repoRoot, root);
  return (readdirSync(absoluteRoot, { recursive: true }) as string[])
    .filter((relativePath) => SOURCE_EXTENSIONS.some((ext) => relativePath.endsWith(ext)))
    .filter((relativePath) => !EXCLUDED_SUFFIXES.some((suffix) => relativePath.endsWith(suffix)))
    .filter((relativePath) => !relativePath.split(/[\\/]/).some((segment) => EXCLUDED_DIRS.has(segment)))
    .map((relativePath) => join(absoluteRoot, relativePath));
}

describe("Arabic UI terminology baseline (V1-791)", () => {
  test("flags deprecated transliterated operational terms", () => {
    expect(findDeprecatedUiTerms("افتح السيرفر ثم راجع اللوج")).toEqual(["السيرفر", "اللوج"]);
  });

  test("accepts the approved operational terms", () => {
    expect(findDeprecatedUiTerms("افتح الخادم ثم راجع السجل")).toEqual([]);
  });

  test("does not match a deprecated term inside a longer Arabic word", () => {
    expect(findDeprecatedUiTerms("تكنولوجيا الخوادم")).toEqual([]);
  });

  test("flags known English operational literals before they reach the Arabic UI", () => {
    const source = '<span className="badge">Audit enforced</span>';

    expect(findForbiddenOperationalTerms(source)).toContain("Audit enforced");
  });

  test("reports the source path with every forbidden operational literal", () => {
    expect(findForbiddenOperationalTermFindings("app/system/control/page.tsx", "Audit enforced")).toEqual([
      { path: "app/system/control/page.tsx", literal: "Audit enforced" },
    ]);
  });
});

describe("Arabic UI terminology guard (V1-791)", () => {
  test("contains no deprecated operational terms across app/, components/, and lib/ source files", () => {
    const offenders: string[] = [];
    for (const root of SOURCE_ROOTS) {
      for (const filePath of listSourceFiles(root)) {
        const source = readFileSync(filePath, "utf8");
        const deprecatedHits = findDeprecatedUiTerms(source);
        const forbiddenFindings = findForbiddenOperationalTermFindings(filePath, source);
        if (deprecatedHits.length > 0) offenders.push(`${filePath}: ${deprecatedHits.join(", ")}`);
        offenders.push(...forbiddenFindings.map(({ path, literal }) => `${path}: ${literal}`));
      }
    }
    expect(offenders).toEqual([]);
  });
});
