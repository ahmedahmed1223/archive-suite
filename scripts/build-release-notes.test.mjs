import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildReleaseNotes } from "./build-release-notes.mjs";

test("builds an Arabic-first GitHub Release body with a collapsible English section", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-release-notes-"));
  const directory = join(root, "docs", "release-notes");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "v1.2.0.ar.md"), "# العربية\n\n- ميزة عربية\n");
  writeFileSync(join(directory, "v1.2.0.md"), "# English\n\n- English feature\n");

  try {
    const notes = buildReleaseNotes("1.2.0", root);
    assert.match(notes, /> \[!TIP\][\s\S]*هذا ملخص الإصدار بالعربية/i);
    assert.match(notes, /<div dir="rtl" align="right">[\s\S]*## العربية[\s\S]*ميزة عربية[\s\S]*<\/div>/);
    assert.match(notes, /## التنزيلات والتحقق/);
    assert.match(notes, /<details>[\s\S]*<summary>English release notes<\/summary>[\s\S]*<div dir="ltr" align="left">[\s\S]*English feature[\s\S]*<\/div>[\s\S]*<\/details>/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a release with a missing language file", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-release-notes-"));
  mkdirSync(join(root, "docs", "release-notes"), { recursive: true });

  try {
    assert.throws(() => buildReleaseNotes("1.2.0", root), /missing release-notes file/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
