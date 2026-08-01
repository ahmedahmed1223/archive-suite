import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const foundation = readFileSync(resolve(process.cwd(), "app/styles/08-foundation.css"), "utf8");

describe("Focus Command token contract", () => {
  it("defines semantic canvas, surface, border, accent, focus and balanced-density tokens", () => {
    for (const token of [
      "--focus-canvas",
      "--focus-surface",
      "--focus-surface-raised",
      "--focus-border",
      "--focus-accent",
      "--focus-ring",
      "--focus-row-min-height"
    ]) {
      expect(foundation).toContain(token);
    }
  });
});
