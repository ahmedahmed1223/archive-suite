import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWhisperReleaseSmoke } from "./smoke-whisper-release.mjs";

test("runs the canonical CLI on CPU with a bounded model and writes evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "whisper-smoke-"));
  const evidence = join(dir, "evidence.json");
  const calls = [];
  try {
    const result = runWhisperReleaseSmoke({
      image: "archive-whisper:test",
      evidencePath: evidence,
      run: (command, args) => {
        calls.push([command, args]);
        return { status: 0, stdout: "BINARY=whisper-ctranslate2\nWEBVTT\n", stderr: "" };
      },
    });
    assert.equal(result.ok, true);
    assert.match(calls[0][1].join(" "), /--device cpu/);
    assert.match(calls[0][1].join(" "), /--compute_type int8/);
    assert.match(calls[0][1].join(" "), /--model tiny/);
    assert.equal(JSON.parse(readFileSync(evidence, "utf8")).binary, "whisper-ctranslate2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when transcription does not produce VTT evidence", () => {
  assert.throws(
    () => runWhisperReleaseSmoke({
      image: "archive-whisper:test",
      evidencePath: join(tmpdir(), "unused-whisper-evidence.json"),
      run: () => ({ status: 0, stdout: "BINARY=whisper-ctranslate2\n", stderr: "" }),
    }),
    /VTT/i,
  );
});

test("fails when the canonical executable is unavailable", () => {
  assert.throws(
    () => runWhisperReleaseSmoke({
      image: "archive-whisper:test",
      evidencePath: join(tmpdir(), "unused-whisper-evidence.json"),
      run: () => ({ status: 127, stdout: "", stderr: "not found" }),
    }),
    /failed.*127/i,
  );
});
