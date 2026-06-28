import { describe, expect, it } from "vitest";

import { parseFirebaseConfigText, sanitizeFirebaseConfig } from "./firebaseConfig.js";

describe("firebaseConfig helpers", () => {
  it("parses pasted Firebase config and keeps only safe client fields", () => {
    const parsed = parseFirebaseConfigText(
      JSON.stringify({
        apiKey: "k",
        projectId: "archive-test",
        appId: "app",
        authDomain: "archive-test.firebaseapp.com",
        storageBucket: "archive-test.appspot.com",
        privateKey: "must-not-survive"
      })
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.config).toEqual({
      apiKey: "k",
      projectId: "archive-test",
      appId: "app",
      authDomain: "archive-test.firebaseapp.com",
      storageBucket: "archive-test.appspot.com"
    });
  });

  it("reports missing required fields", () => {
    const result = sanitizeFirebaseConfig({ apiKey: "k" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("projectId");
    expect(result.errors).toContain("appId");
  });
});
