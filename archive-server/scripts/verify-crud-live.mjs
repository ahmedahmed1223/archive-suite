// Live CRUD verification against the running Dockerized Postgres backend.
// Exercises the exact StorageProvider RPC ops the SPA pages use (add / getAll /
// get / put / delete / putBatch / deleteBatch) for every page-backing store.
// Reads local test admin creds from ../.env (local container only).

import { readFileSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:8787";
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD })
}).then((r) => r.json());
if (!loginRes.token) { console.error("LOGIN FAILED:", loginRes.error || loginRes); process.exit(1); }
const token = loginRes.token;
console.log(`login: ok (user ${loginRes.user?.username || env.ADMIN_USERNAME}, role ${loginRes.user?.role || "?"})`);

async function rpc(method, args) {
  const r = await fetch(`${BASE}/api/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ method, args })
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}(${args[0]}) -> ${r.status} ${j.error}`);
  return j.result;
}

// store -> a representative record (mirrors what each page creates)
const cases = [
  ["content_types (إدارة الأنواع)", "content_types", { id: "t_crud", name: "نوع اختبار", color: "#10b981" }],
  ["video_items (الأرشيف/إضافة/تفاصيل)", "video_items", { id: "v_crud", title: "فيديو اختبار", type: "t_crud", tags: ["x"] }],
  ["virtual_collections (المجموعات)", "virtual_collections", { id: "c_crud", name: "مجموعة اختبار", type: "manual" }],
  ["vocabulary (القاموس)", "vocabulary", { id: "voc_crud", term: "مصطلح اختبار", category: "other" }],
  ["hierarchical_tags (الوسوم الهرمية)", "hierarchical_tags", { id: "ht_crud", name: "وسم اختبار", parentId: null }],
  ["projects (مشاريع المونتاج)", "projects", { id: "p_crud", name: "مشروع اختبار", roughCuts: [], tasks: [] }]
];

let pass = 0, fail = 0;
for (const [label, store, rec] of cases) {
  try {
    await rpc("add", [store, rec]);
    const afterAdd = await rpc("getAll", [store]);
    if (!afterAdd.some((r) => r.id === rec.id)) throw new Error("add not visible in getAll");
    await rpc("put", [store, { ...rec, name: (rec.name || rec.title || "") + " (معدّل)", title: rec.title ? rec.title + " (معدّل)" : undefined, _edited: true }]);
    const edited = await rpc("get", [store, rec.id]);
    if (!edited?._edited) throw new Error("edit (put) did not persist");
    await rpc("delete", [store, rec.id]);
    const gone = await rpc("get", [store, rec.id]);
    if (gone) throw new Error("delete did not remove");
    console.log(`ok - ${label}: add → getAll → put(edit) → get → delete`);
    pass += 1;
  } catch (error) {
    console.error(`NOT OK - ${label}: ${error.message}`);
    fail += 1;
  }
}

// batch + snapshot/replaceAll (import/export + bulk paths)
try {
  await rpc("putBatch", ["video_items", [{ id: "vb1", title: "دفعة 1" }, { id: "vb2", title: "دفعة 2" }]]);
  const all = await rpc("getAll", ["video_items"]);
  if (!(all.some((r) => r.id === "vb1") && all.some((r) => r.id === "vb2"))) throw new Error("putBatch missing");
  await rpc("deleteBatch", ["video_items", ["vb1", "vb2"]]);
  const snap = await rpc("snapshot", []);
  console.log(`ok - bulk: putBatch → getAll → deleteBatch → snapshot (snapshot keys: ${Object.keys(snap || {}).length})`);
  pass += 1;
} catch (error) { console.error(`NOT OK - bulk: ${error.message}`); fail += 1; }

console.log(`\n${fail === 0 ? "ALL LIVE CRUD CHECKS PASSED" : "SOME CHECKS FAILED"} — ${pass} ok, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
