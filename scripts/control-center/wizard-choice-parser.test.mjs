import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWizardChoices } from "./wizard-choice-parser.mjs";

const profileOptions = ["core", "media", "edge"];

test("parses separators, numbers, and aliases in declared option order", () => {
  assert.deepEqual(
    parseWizardChoices("Media + EDGE", {
      options: profileOptions,
      aliases: { media: "media", edge: "edge" },
    }),
    ["media", "edge"],
  );
  assert.deepEqual(
    parseWizardChoices("3, 2", { options: profileOptions }),
    ["media", "edge"],
  );
  assert.deepEqual(
    parseWizardChoices("ocr, tls", {
      options: ["ocr", "edge"],
      aliases: { ocr: "ocr", tls: "edge" },
    }),
    ["ocr", "edge"],
  );
});

test("supports all and none only when explicitly allowed", () => {
  assert.deepEqual(
    parseWizardChoices("all", { options: ["media", "edge"], allowAll: true }),
    ["media", "edge"],
  );
  assert.deepEqual(
    parseWizardChoices("none", { options: ["media", "edge"], allowNone: true }),
    [],
  );
});

test("deduplicates selections and rejects unknown or ambiguous special tokens", () => {
  assert.deepEqual(
    parseWizardChoices("media, media, 1", { options: ["media", "edge"] }),
    ["media"],
  );
  const unknown = parseWizardChoices("media, accelerated", { options: ["media", "edge"] });
  assert.equal(unknown.code, "CHOICE_UNKNOWN");
  assert.match(unknown.message, /\[REDACTED_INPUT\]/);
  assert.doesNotMatch(unknown.message, /accelerated/i);
  const mixed = parseWizardChoices("all, media", { options: ["media", "edge"], allowAll: true });
  assert.equal(mixed.code, "CHOICE_SPECIAL_TOKEN_MIXED");
});

test("redacts raw unknown tokens so interactive errors cannot reveal credential URLs", () => {
  const result = parseWizardChoices("https://operator:topsecret@example.test/media", { options: ["media", "edge"] });
  assert.equal(result.code, "CHOICE_UNKNOWN");
  assert.doesNotMatch(result.message, /topsecret|operator|example\.test/i);
  assert.match(result.message, /\[REDACTED_INPUT\]/);
});
