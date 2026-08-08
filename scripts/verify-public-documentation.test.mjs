import assert from "node:assert/strict";
import test from "node:test";

import { validateDocumentation } from "./verify-public-documentation.mjs";

test("reports a missing paired language file", () => {
  const result = validateDocumentation({
    files: new Set(["README.md"]),
    contents: new Map([["README.md", "# Masar"]]),
    pairs: [["README.md", "README.ar.md"]],
  });

  assert.match(result.errors.join("\n"), /README\.ar\.md/);
});

test("accepts paired documents with reciprocal language links", () => {
  const result = validateDocumentation({
    files: new Set(["README.md", "README.ar.md"]),
    contents: new Map([
      ["README.md", "[العربية](README.ar.md)"],
      ["README.ar.md", "[English](README.md)"],
    ]),
    pairs: [["README.md", "README.ar.md"]],
  });

  assert.deepEqual(result.errors, []);
});

test("reports a missing relative Markdown target", () => {
  const result = validateDocumentation({
    files: new Set(["docs/README.md", "docs/README.ar.md"]),
    contents: new Map([
      ["docs/README.md", "[Arabic](README.ar.md) and [guide](missing.md)"],
      ["docs/README.ar.md", "[English](README.md)"],
    ]),
    pairs: [["docs/README.md", "docs/README.ar.md"]],
  });

  assert.match(result.errors.join("\n"), /docs\/missing\.md/);
});
