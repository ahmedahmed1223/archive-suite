import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { RTL_DOCUMENT_CONTRACT, isRtlLtrException } from "@/lib/rtl-contract";

describe("RTL operational contract (V1-306B)", () => {
  test("declares Arabic RTL at the document root", () => {
    const layout = readFileSync(fileURLToPath(new URL("../app/layout.tsx", import.meta.url)), "utf8");
    expect(layout).toContain(`<html lang="${RTL_DOCUMENT_CONTRACT.language}" dir="${RTL_DOCUMENT_CONTRACT.direction}"`);
  });

  test("limits LTR overrides to machine-readable exception kinds", () => {
    expect(isRtlLtrException("email")).toBe(true);
    expect(isRtlLtrException("button-label")).toBe(false);
  });
});
