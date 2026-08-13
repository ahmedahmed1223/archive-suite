import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildReleaseNotes } from "./build-release-notes.mjs";

test("combines Arabic and English release notes into one GitHub Release body", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-release-notes-"));
  const directory = join(root, "docs", "release-notes");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "v1.2.0.ar.md"), "# العربية\n\n- ميزة عربية\n");
  writeFileSync(join(directory, "v1.2.0.md"), "# English\n\n- English feature\n");

  try {
    const notes = buildReleaseNotes("1.2.0", root);
    assert.match(notes, /## العربية[\s\S]*ميزة عربية[\s\S]*## English[\s\S]*English feature/);
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
