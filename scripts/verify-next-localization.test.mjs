import assert from "node:assert/strict";
import test from "node:test";
import { collectArabicInterfaceLiterals } from "./verify-next-localization.mjs";

test("reports Arabic interface literals outside approved localization sources", () => {
  const findings = collectArabicInterfaceLiterals({
    files: {
      "archive-next/components/Ready.tsx": 'const title = "جاهز";',
      "archive-next/lib/i18n/dictionaries/ar/shared.ts": 'export const shared = { ready: "جاهز" };',
      "archive-next/lib/brand.ts": 'export const brand = { arabicName: "مسار" };',
      "archive-next/components/Search.tsx": 'const normalized = value.replace(/ة/g, "ه");',
    },
  });

  assert.deepEqual(findings, [
    { file: "archive-next/components/Ready.tsx", line: 1, literal: "جاهز" },
  ]);
});
