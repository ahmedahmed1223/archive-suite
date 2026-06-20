import { describe, expect, it } from "vitest";

import { ONBOARDING_STORAGE_OPTIONS } from "./flow.js";

describe("cloud onboarding storage defaults", () => {
  it("allows bundled Postgres to use the same origin without a URL", () => {
    const postgres = ONBOARDING_STORAGE_OPTIONS.find((option) => option.id === "postgres");
    expect(postgres?.allowsSameOrigin).toBe(true);
  });
});
