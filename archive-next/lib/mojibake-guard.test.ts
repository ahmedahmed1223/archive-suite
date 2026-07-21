import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findMojibake } from "@/lib/mojibake-guard";

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

// Fixtures are built from real UTF-8 bytes re-decoded as latin1, not typed
// literally - see the "why" comment in lib/mojibake-guard.ts.
function mojibakify(arabicText: string): string {
  return Buffer.from(arabicText, "utf8").toString("latin1");
}

describe("findMojibake", () => {
  it("flags a genuine UTF-8-as-Latin1 mis-decode", () => {
    const corrupted = mojibakify("أرشيف");
    expect(findMojibake(corrupted).length).toBeGreaterThan(0);
  });

  it("does not flag clean Arabic or Latin text", () => {
    expect(findMojibake("أرشيف نظيف")).toEqual([]);
    expect(findMojibake("cafe menu")).toEqual([]);
  });

  it("flags the Unicode replacement character", () => {
    expect(findMojibake(`broken ${String.fromCharCode(0xfffd)} text`)).toEqual([String.fromCharCode(0xfffd)]);
  });
});

describe("mojibake guard (V1-306B)", () => {
  it("contains no mojibake across app/, components/, and lib/ source files", () => {
    const offenders: string[] = [];
    for (const root of SOURCE_ROOTS) {
      for (const filePath of listSourceFiles(root)) {
        const hits = findMojibake(readFileSync(filePath, "utf8"));
        if (hits.length > 0) offenders.push(`${filePath}: ${hits.join(", ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
