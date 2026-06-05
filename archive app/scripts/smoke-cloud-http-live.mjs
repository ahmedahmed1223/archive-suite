// Live end-to-end smoke: the SPA's cloud-http adapter against a running
// archive-server RPC API (which writes to real Postgres). Proves the full
// chain SPA adapter → /api/rpc → Postgres adapter → Postgres.
//
// Run: API_BASE=http://127.0.0.1:8790 node scripts/smoke-cloud-http-live.mjs
// Not part of `npm run verify` (that stays offline with a fetch fake).

import assert from "node:assert/strict";
import { createCloudHttpProvider } from "../src/storage/adapters/cloud-http/index.js";

const baseUrl = process.env.API_BASE || "http://127.0.0.1:8790";
const provider = createCloudHttpProvider({ baseUrl });

try {
  await provider.clear("video_items");
  await provider.clear("content_types");

  await provider.put("content_types", { id: "ct1", name: "مقابلة" });
  await provider.put("video_items", { id: "vi1", title: "مادة عبر الـ SPA", tags: ["حيّ"] });
  await provider.add("video_items", { id: "vi2", title: "مادة ثانية" });

  const one = await provider.get("video_items", "vi1");
  assert.equal(one.title, "مادة عبر الـ SPA");
  assert.deepEqual(one.tags, ["حيّ"]);

  // upsert must not duplicate
  await provider.put("video_items", { id: "vi1", title: "محدّثة عبر الـ SPA" });
  let all = await provider.getAll("video_items");
  assert.equal(all.length, 2);

  const counts = await provider.replaceAll({
    contentTypes: [{ id: "t1", name: "نوع" }],
    videoItems: [{ id: "a" }, { id: "b" }, { id: "c" }],
    settings: { theme: "light", key: "app_settings" }
  });
  assert.equal(counts.videoItems, 3);

  const snap = await provider.snapshot();
  assert.deepEqual(snap.videoItems.map((r) => r.id).sort(), ["a", "b", "c"]);
  assert.equal(snap.settings.theme, "light");

  console.log("✓ LIVE SPA→API→Postgres: full chain persisted correctly");
  console.log("  video_items after replaceAll:", snap.videoItems.map((r) => r.id).join(", "));
} catch (error) {
  console.error("✗ LIVE cloud-http FAILED:", error?.message || error);
  process.exitCode = 1;
}
