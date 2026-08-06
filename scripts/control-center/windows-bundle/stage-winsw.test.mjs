import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WINDOWS_SERVICES } from "../windows-services.mjs";
import { stageWinswCopies, WINSW_SHA256, WINSW_URL } from "./stage-winsw.mjs";

test("stageWinswCopies writes one identically-named WinSW.exe copy per service id", async () => {
  const destDir = mkdtempSync(join(tmpdir(), "archive-winsw-stage-"));
  try {
    const fetch = async (url) => { assert.equal(url, WINSW_URL); return Buffer.from("fake-winsw-binary"); };
    const result = await stageWinswCopies({ destDir, fetch, sha256: () => WINSW_SHA256 });
    assert.equal(result.ok, true);
    assert.equal(result.exePaths.length, WINDOWS_SERVICES.length);
    for (const service of WINDOWS_SERVICES) {
      const expectedPath = join(destDir, `${service.id}.exe`);
      assert.ok(existsSync(expectedPath));
      assert.equal(readFileSync(expectedPath, "utf8"), "fake-winsw-binary");
    }
  } finally {
    rmSync(destDir, { recursive: true, force: true });
  }
});
