import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveWizardLang, hasExplicitLang, createTranslator, MESSAGES } from "./wizard-i18n.mjs";
import { MIN_NODE_VERSION, isSupportedNodeVersion } from "./node-version.mjs";

test("defaults to English", () => {
  assert.equal(resolveWizardLang([], {}), "en");
});

test("--lang=ar selects Arabic", () => {
  assert.equal(resolveWizardLang(["--lang=ar"], {}), "ar");
});

test("ARCHIVE_WIZARD_LANG env selects Arabic", () => {
  assert.equal(resolveWizardLang([], { ARCHIVE_WIZARD_LANG: "ar" }), "ar");
});

test("unknown language falls back to English", () => {
  assert.equal(resolveWizardLang(["--lang=fr"], {}), "en");
});

test("hasExplicitLang detects flag and env", () => {
  assert.equal(hasExplicitLang(["--lang=ar"], {}), true);
  assert.equal(hasExplicitLang([], { ARCHIVE_WIZARD_LANG: "ar" }), true);
  assert.equal(hasExplicitLang([], {}), false);
});

test("translator returns the right language string", () => {
  const en = createTranslator("en");
  const ar = createTranslator("ar");
  assert.equal(en("step1"), "Environment check");
  assert.equal(ar("step1"), "فحص البيئة");
});

test("translator interpolates params", () => {
  const en = createTranslator("en");
  assert.equal(en("publicMode", { domain: "x.com" }), "Public mode: https://x.com");
  assert.equal(en("composeExit", { code: 7 }), "docker compose exited with code 7");
});

test("setup and deployment require the workspace Node minimum", () => {
  assert.equal(MIN_NODE_VERSION, "22.12.0");
  assert.equal(isSupportedNodeVersion("v22.11.0"), false);
  assert.equal(isSupportedNodeVersion("v22.12.0"), true);
  assert.equal(isSupportedNodeVersion("v24.0.0"), true);
  assert.match(createTranslator("en")("nodeTooOld", { version: "v18.20.0" }), /22\.12\+/);
});

test("unknown key returns the key itself", () => {
  assert.equal(createTranslator("en")("does-not-exist"), "does-not-exist");
});

test("every message has an English value (default must never be missing)", () => {
  for (const [key, entry] of Object.entries(MESSAGES)) {
    assert.ok(entry.en !== undefined, `missing en for ${key}`);
  }
});
