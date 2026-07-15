import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("auth session bootstrap", () => {
  it("refreshes directly so the session retains the issued access token", () => {
    const source = readFileSync(new URL("./auth-session.tsx", import.meta.url), "utf8");

    expect(source).toContain("const refreshed = await refreshBootstrap(api);");
    expect(source).not.toContain("const response = await api.me();");
    expect(source).toContain('current.status === "authenticated" ? current');
  });
});
