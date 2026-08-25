import { describe, expect, it } from "vitest";
import { readWorkspacePreferences } from "./workspace-preferences";

describe("workspace resume persistence", () => {
  it("preserves the last route after parsing v3 preferences", () => {
    const value = readWorkspacePreferences(JSON.stringify({
      version: 3,
      routes: {},
      lastWorkspaceRoute: "/archive",
      lastVisitedAt: "2026-08-24T10:00:00.000Z",
    }));
    expect(value.lastWorkspaceRoute).toBe("/archive");
  });
});
