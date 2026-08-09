import assert from "node:assert/strict";
import test from "node:test";

import { collectWizardRuntimeChoices } from "./setup-wizard.mjs";

const contract = {
  dataPaths: { windows: { storage: "C:\\ArchiveSuite\\data\\storage" } },
  platforms: [{ id: "windows-native", mode: "native", dataPathFamily: "windows" }],
};

test("Native wizard keeps PostgreSQL and pgAdmin as the baseline while offering disabled Redis", async () => {
  const answers = ["native", "windows-native", "offline", "local", "C:\\ArchiveData", "none", "none", "managed", "none"];
  const { candidate } = await collectWizardRuntimeChoices({
    ask: async () => answers.shift(),
    contract,
    platformId: "windows-native",
  });

  assert.deepEqual(candidate.dataServices, {
    postgres: { enabled: true, kind: "managed" },
    redis: { enabled: false },
  });
});
