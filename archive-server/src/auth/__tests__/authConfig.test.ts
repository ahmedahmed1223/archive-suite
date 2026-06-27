import { describe, expect, it } from "vitest";

import { resolveAuthSigningSecret } from "../authConfig.js";

describe("resolveAuthSigningSecret", () => {
  it("uses the dedicated auth secret when the legacy secret is empty", () => {
    expect(resolveAuthSigningSecret({
      JWT_AUTH_SECRET: "dedicated-secret",
      JWT_SECRET: ""
    })).toBe("dedicated-secret");
  });

  it("falls back to the legacy JWT secret", () => {
    expect(resolveAuthSigningSecret({ JWT_SECRET: "legacy-secret" })).toBe("legacy-secret");
  });
});
