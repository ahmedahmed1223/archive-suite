import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(resolve(process.cwd(), "components/AsyncStateSurface.tsx"), "utf8");

describe("AsyncStateSurface source contract", () => {
  it("supports loading, empty, error and success states", () => {
    expect(componentSource).toContain('status: "loading" | "empty" | "error" | "success"');
    expect(componentSource).toContain('status === "success"');
    expect(componentSource).toContain('aria-busy={status === "loading"}');
  });

  it("announces asynchronous changes and exposes one primary recovery action", () => {
    expect(componentSource).toContain('aria-live={status === "error" ? "assertive" : "polite"}');
    expect(componentSource).toContain("action?: AsyncStateAction");
    expect(componentSource).toContain("onClick={action.onClick}");
    expect(componentSource).toContain("action.label");
    expect(componentSource).toContain("onRetry?: () => void");
    expect(componentSource).toContain("retryLabel?: string");
  });
});
