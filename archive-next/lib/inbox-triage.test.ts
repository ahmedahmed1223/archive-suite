import { describe, expect, it } from "vitest";
import { triageCommand } from "./inbox-triage";

describe("triageCommand", () => {
  it("maps navigation, status and open keys", () => {
    expect(triageCommand("j")).toEqual({ type: "move", offset: 1 });
    expect(triageCommand("ArrowUp")).toEqual({ type: "move", offset: -1 });
    expect(triageCommand("3")).toEqual({ type: "status", status: "ready" });
    expect(triageCommand("Enter")).toEqual({ type: "open" });
  });

  it("ignores shortcuts while the user is editing", () => {
    expect(triageCommand("2", true)).toBeNull();
    expect(triageCommand("x")).toBeNull();
  });
});
