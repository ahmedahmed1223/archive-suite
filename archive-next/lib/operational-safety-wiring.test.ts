import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appRoot = new URL("../app/", import.meta.url);

function pageSource(path: string) {
  return readFileSync(new URL(path, appRoot), "utf8");
}

describe("operational safety wiring", () => {
  it("renders a confirmation control only through an owning action callback", () => {
    const source = readFileSync(new URL("../components/OperationalSafetyPanel.tsx", import.meta.url), "utf8");

    expect(source).toContain("onConfirm?: () => void");
    expect(source).toContain("onClick={onConfirm}");
    expect(source).not.toContain("تم التأكيد محلياً");
  });

  it("keeps high-impact disclosures separate from actions that cannot be confirmed by the panel", () => {
    for (const path of ["automation/page.tsx", "broadcast/page.tsx", "collaboration/page.tsx"]) {
      expect(pageSource(path)).not.toContain('impact="high"');
    }
  });

  it("describes Copilot rights as server-enforced review instead of browser approval", () => {
    const source = pageSource("copilot/page.tsx");

    expect(source).toContain('rights="review"');
    expect(source).toContain("الخادم يطبق سياسات الحقوق والصلاحيات");
    expect(source).not.toContain('rights={status?.configured ? "allowed" : "blocked"}');
  });
});
