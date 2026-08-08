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

test("reports tracked Markdown that is absent from the publication manifest", () => {
  const result = validateDocumentation({
    files: new Set(["README.md", "README.ar.md", "docs/unclassified.md"]),
    contents: new Map([
      ["README.md", "[العربية](README.ar.md)"],
      ["README.ar.md", "[English](README.md)"],
      ["docs/unclassified.md", "# Internal note"],
    ]),
    documents: [{ english: "README.md", arabic: "README.ar.md", lifecycle: "living" }],
    excludedTrees: [],
    excludedFiles: [],
  });

  assert.match(result.errors.join("\n"), /docs\/unclassified\.md.*unclassified/i);
});

test("enforces the public bilingual filename convention", () => {
  const result = validateDocumentation({
    files: new Set(["docs/guide.en.md", "docs/guide.md"]),
    contents: new Map([
      ["docs/guide.en.md", "[العربية](guide.md)"],
      ["docs/guide.md", "[English](guide.en.md)"],
    ]),
    documents: [{ id: "guide", english: "docs/guide.en.md", arabic: "docs/guide.md", lifecycle: "living" }],
    excludedTrees: [],
    excludedFiles: [],
  });

  assert.match(result.errors.join("\n"), /English path must not end in \.en\.md/);
  assert.match(result.errors.join("\n"), /Arabic path must end in \.ar\.md/);
});

test("rejects links from public documentation into excluded internal trees", () => {
  const result = validateDocumentation({
    files: new Set(["README.md", "README.ar.md", "docs/internal/plan.md"]),
    contents: new Map([
      ["README.md", "[العربية](README.ar.md) [plan](docs/internal/plan.md)"],
      ["README.ar.md", "[English](README.md)"],
    ]),
    documents: [{ id: "home", english: "README.md", arabic: "README.ar.md", lifecycle: "living" }],
    excludedTrees: [{ path: "docs/internal/", lifecycle: "internal" }],
    excludedFiles: [],
  });

  assert.match(result.errors.join("\n"), /links to excluded documentation/);
});

test("rejects internal delivery-stage language in living public documentation", () => {
  const result = validateDocumentation({
    files: new Set(["README.md", "README.ar.md"]),
    contents: new Map([
      ["README.md", "[العربية](README.ar.md)\n\nNext phase: finish cutover."],
      ["README.ar.md", "[English](README.md)"],
    ]),
    documents: [{ id: "home", english: "README.md", arabic: "README.ar.md", lifecycle: "living" }],
    excludedTrees: [],
    excludedFiles: [],
  });

  assert.match(result.errors.join("\n"), /internal delivery-stage language/);
});

test("checks required semantic sections in both languages", () => {
  const result = validateDocumentation({
    files: new Set(["docs/install.md", "docs/install.ar.md"]),
    contents: new Map([
      ["docs/install.md", "[العربية](install.ar.md)\n\n## Requirements"],
      ["docs/install.ar.md", "[English](install.md)"],
    ]),
    documents: [{
      id: "install",
      english: "docs/install.md",
      arabic: "docs/install.ar.md",
      lifecycle: "living",
      sections: [{ id: "requirements", english: "Requirements", arabic: "المتطلبات" }],
    }],
    excludedTrees: [],
    excludedFiles: [],
  });

  assert.match(result.errors.join("\n"), /missing Arabic section requirements/);
});

test("reports a broken heading anchor between public pages", () => {
  const result = validateDocumentation({
    files: new Set(["docs/README.md", "docs/README.ar.md"]),
    contents: new Map([
      ["docs/README.md", "[العربية](README.ar.md)\n\n[Install](README.ar.md#missing)"],
      ["docs/README.ar.md", "[English](README.md)\n\n## التثبيت"],
    ]),
    pairs: [["docs/README.md", "docs/README.ar.md"]],
  });

  assert.match(result.errors.join("\n"), /missing heading anchor #missing/);
});
