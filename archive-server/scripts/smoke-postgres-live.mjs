// Live Postgres smoke test — requires a running Postgres + applied migration.
// Run: DATABASE_URL=... npx tsx scripts/smoke-postgres-live.mjs
// Not part of `npm run verify` (that stays DB-free); this is for manual /
// CI-with-services verification that data really lands in Postgres.

import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPostgresStorageProvider } from "../src/adapters/cloud-postgres-prisma/storage.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const provider = createPostgresStorageProvider(prisma);

try {
  await provider.open();

  // Clean slate for a deterministic run.
  await provider.clear("video_items");
  await provider.clear("content_types");

  // Per-record writes.
  await provider.put("content_types", { id: "type-1", name: "مقابلة" });
  await provider.put("video_items", { id: "real-1", title: "مادة حقيقية", tags: ["اختبار"] });
  await provider.add("video_items", { id: "real-2", title: "مادة ثانية" });

  const one = await provider.get("video_items", "real-1");
  assert.equal(one.title, "مادة حقيقية");
  assert.deepEqual(one.tags, ["اختبار"]);

  // Upsert must not duplicate.
  await provider.put("video_items", { id: "real-1", title: "محدّثة" });
  let all = await provider.getAll("video_items");
  assert.equal(all.length, 2);

  // Whole-dataset replace (atomic transaction).
  const counts = await provider.replaceAll({
    contentTypes: [{ id: "t1", name: "نوع" }],
    videoItems: [{ id: "v1", title: "فيديو 1" }, { id: "v2", title: "فيديو 2" }],
    settings: { theme: "dark", key: "app_settings" }
  });
  assert.equal(counts.videoItems, 2);

  const snap = await provider.snapshot();
  assert.deepEqual(snap.videoItems.map((r) => r.id).sort(), ["v1", "v2"]);
  assert.equal(snap.settings.theme, "dark");
  assert.equal(snap.version, "2.0");

  console.log("✓ LIVE POSTGRES: per-record + upsert + replaceAll + snapshot all persisted correctly");
  console.log("  video_items after replaceAll:", snap.videoItems.map((r) => r.id).join(", "));
  console.log("  settings.theme:", snap.settings.theme);
} catch (error) {
  console.error("✗ LIVE POSTGRES FAILED:", error?.message || error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
