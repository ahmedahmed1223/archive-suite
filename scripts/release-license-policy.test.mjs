import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLicenseExpression } from "./release-license-policy.mjs";

const policy = {
  allowed: new Set(["MIT", "Apache-2.0", "BSD-3-Clause"]),
  forbidden: new Set(["GPL-3.0-only", "SSPL-1.0"]),
  exceptions: new Set(),
};

const evaluate = (expression) => evaluateLicenseExpression("example/package", expression, policy);

test("accepts a wholly allowed parenthesized OR expression", () => {
  assert.deepEqual(evaluate("(MIT OR Apache-2.0)"), { accepted: true, rejected: [] });
});

test("accepts OR when one complete alternative is allowed", () => {
  assert.deepEqual(evaluate("GPL-3.0-only OR MIT"), { accepted: true, rejected: [] });
});

test("rejects when an AND branch requires a forbidden license after an allowed OR group", () => {
  assert.deepEqual(evaluate("(MIT OR Apache-2.0) AND GPL-3.0-only"), {
    accepted: false,
    rejected: [{ kind: "forbidden", license: "GPL-3.0-only" }],
  });
});

test("rejects OR when every complete alternative is forbidden or unknown", () => {
  assert.deepEqual(evaluate("SSPL-1.0 OR LicenseRef-Proprietary"), {
    accepted: false,
    rejected: [
      { kind: "forbidden", license: "SSPL-1.0" },
      { kind: "unknown", license: "LicenseRef-Proprietary" },
    ],
  });
});

test("rejects an allowed AND unknown expression", () => {
  assert.deepEqual(evaluate("MIT AND LicenseRef-Unknown"), {
    accepted: false,
    rejected: [{ kind: "unknown", license: "LicenseRef-Unknown" }],
  });
});

test("rejects malformed expressions instead of weakening the policy", () => {
  assert.throws(() => evaluate("MIT OR (Apache-2.0 AND)"), /Invalid SPDX expression/);
});
