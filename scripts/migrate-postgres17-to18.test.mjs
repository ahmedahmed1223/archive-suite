import assert from "node:assert/strict";
import test from "node:test";
import { migratePostgres17To18 } from "./migrate-postgres17-to18.mjs";

test("migrates a running PostgreSQL 17 container into the fresh PostgreSQL 18 Compose volume without deleting the source", async () => {
  const commands = [];
  const result = await migratePostgres17To18({
    sourceContainer: "archive-ln-postgres",
    composeFile: "infra/docker-compose.yml",
    environment: { POSTGRES_USER: "archive", POSTGRES_DB: "archive" },
    runCommand: async (command, args, options = {}) => {
      commands.push({ command, args, options });
      if (args[0] === "inspect" && args.at(-1) === "archive-ln-postgres") return "pgvector/pgvector:pg17";
      return "";
    },
  });

  assert.deepEqual(result, { sourceContainer: "archive-ln-postgres", targetMajor: 18 });
  assert.ok(commands.some(({ args }) => args.join(" ").includes("exec archive-ln-postgres pg_dumpall -U archive")));
  assert.ok(commands.some(({ args }) => args.join(" ").includes("compose -f infra/docker-compose.yml up -d postgres")));
  assert.ok(commands.some(({ args }) => args.join(" ").includes("compose -f infra/docker-compose.yml exec -T postgres psql -U archive -d postgres")));
  assert.ok(!commands.some(({ args }) => args.includes("rm") && args.includes("archive-ln-postgres")), "the PostgreSQL 17 container must not be deleted");
});

test("refuses a source container that is not a PostgreSQL 17 image", async () => {
  await assert.rejects(
    migratePostgres17To18({
      sourceContainer: "archive-ln-postgres",
      runCommand: async () => "pgvector/pgvector:pg18",
    }),
    /PostgreSQL 17/,
  );
});
