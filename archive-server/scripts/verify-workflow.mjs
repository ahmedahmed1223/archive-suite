import assert from "node:assert/strict";

import {
  WORKFLOW_STATES,
  STATE_LABELS,
  getWorkflowDefinition,
  getRecordState,
  getAvailableTransitions,
  canTransition,
  applyTransition,
} from "../src/workflow/stateMachine.js";
import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";

// Workflow (§20.3) tests — pure state machine + HTTP enforcement, all offline.

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.stack || err.message}`); });
}

const SECRET = "workflow-secret";
const bearer = (role, sub = "u1") => `Bearer ${signJwt({ sub, username: `${role}-user`, role }, SECRET)}`;

function fakeStorage(records) {
  const byId = new Map(records.map((r) => [r.id, r]));
  return {
    async get(store, id) { return byId.get(id) || null; },
    async getAll() { return [...byId.values()]; },
    async put(store, record) { byId.set(record.id, record); return record; },
    __byId: byId,
  };
}

run("definition exposes all six states with Arabic labels and role-gated transitions", () => {
  const def = getWorkflowDefinition();
  assert.deepEqual(def.states, ["draft", "editing", "review", "approved", "published", "archived"]);
  assert.equal(def.defaultState, "draft");
  for (const state of def.states) assert.ok(def.labels[state], `label for ${state}`);
  // approval is admin/owner only
  const approve = def.transitions.find((t) => t.from === "review" && t.to === "approved");
  assert.deepEqual(approve.roles, ["admin", "owner"]);
});

run("getRecordState falls back to draft for legacy records", () => {
  assert.equal(getRecordState({}), "draft");
  assert.equal(getRecordState({ workflowStatus: "bogus" }), "draft");
  assert.equal(getRecordState({ workflowStatus: "review" }), "review");
});

run("role gating: editor can author but not approve/publish; admin can", () => {
  assert.equal(canTransition({ from: "editing", to: "review", role: "editor" }), true);
  assert.equal(canTransition({ from: "review", to: "approved", role: "editor" }), false);
  assert.equal(canTransition({ from: "review", to: "approved", role: "admin" }), true);
  assert.equal(canTransition({ from: "approved", to: "published", role: "editor" }), false);
  assert.equal(canTransition({ from: "approved", to: "published", role: "owner" }), true);
  assert.deepEqual(getAvailableTransitions("review", "editor"), ["editing"]);
  assert.deepEqual(getAvailableTransitions("review", "admin"), ["editing", "approved"]);
  assert.deepEqual(getAvailableTransitions("draft", "viewer"), []);
});

run("applyTransition is immutable and appends a history entry", () => {
  const original = { id: "rec1", title: "سجل", workflowStatus: "editing" };
  const { record, entry } = applyTransition(original, {
    to: "review", role: "editor", userId: "u1", username: "ed",
    dueDate: "2026-07-01", note: "جاهز للمراجعة",
    now: () => "2026-06-11T10:00:00.000Z",
  });
  // original untouched
  assert.equal(original.workflowStatus, "editing");
  assert.equal(original.workflowHistory, undefined);
  // new record carries the transition
  assert.equal(record.workflowStatus, "review");
  assert.equal(record.workflowDueDate, "2026-07-01");
  assert.equal(record.workflowHistory.length, 1);
  assert.deepEqual(entry, {
    from: "editing", to: "review", by: "u1", byUsername: "ed",
    at: "2026-06-11T10:00:00.000Z", note: "جاهز للمراجعة", dueDate: "2026-07-01",
  });
});

run("applyTransition rejects unknown/same states, forbidden roles, bad due dates", () => {
  const rec = { id: "r", workflowStatus: "review" };
  assert.throws(() => applyTransition(rec, { to: "nope", role: "admin", userId: "u" }), /غير معروفة/);
  assert.throws(() => applyTransition(rec, { to: "review", role: "admin", userId: "u" }), /بالفعل/);
  assert.throws(() => applyTransition(rec, { to: "approved", role: "editor", userId: "u" }), /غير مسموح/);
  assert.throws(
    () => applyTransition({ workflowStatus: "editing" }, { to: "review", role: "editor", userId: "u", dueDate: "not-a-date" }),
    /استحقاق/
  );
});

run("HTTP: transition endpoint persists state, logs history, and fires the webhook", async () => {
  const storage = fakeStorage([{ id: "rec1", title: "وثيقة", ownerId: "u9", workflowStatus: "editing" }]);
  const webhookEvents = [];
  const prisma = {
    webhook: {
      async findMany({ where }) {
        webhookEvents.push(where.events.has);
        return []; // no hooks registered — we only assert the event name
      },
    },
  };
  const server = createApiServer({
    backend: "test", authSecret: SECRET, prisma,
    resolveStorage: () => storage, rateLimit: null,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    // definition is served behind auth
    const defRes = await fetch(`${base}/api/workflow/definition`, { headers: { Authorization: bearer("editor") } });
    assert.equal(defRes.status, 200);
    assert.equal((await defRes.json()).definition.states.length, 6);

    // editor moves editing → review
    const ok = await fetch(`${base}/api/workflow/transition`, {
      method: "POST",
      headers: { Authorization: bearer("editor"), "Content-Type": "application/json" },
      body: JSON.stringify({ id: "rec1", to: "review", note: "للمراجعة" }),
    });
    assert.equal(ok.status, 200);
    const result = (await ok.json()).result;
    assert.equal(result.status, "review");
    assert.equal(result.entry.from, "editing");
    const stored = storage.__byId.get("rec1");
    assert.equal(stored.workflowStatus, "review");
    assert.equal(stored.workflowHistory.length, 1);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(webhookEvents, ["record.status_changed"]);

    // editor may NOT approve
    const forbidden = await fetch(`${base}/api/workflow/transition`, {
      method: "POST",
      headers: { Authorization: bearer("editor"), "Content-Type": "application/json" },
      body: JSON.stringify({ id: "rec1", to: "approved" }),
    });
    assert.equal(forbidden.status, 403);

    // admin approves
    const approved = await fetch(`${base}/api/workflow/transition`, {
      method: "POST",
      headers: { Authorization: bearer("admin"), "Content-Type": "application/json" },
      body: JSON.stringify({ id: "rec1", to: "approved", dueDate: "2026-07-15" }),
    });
    assert.equal(approved.status, 200);
    assert.equal(storage.__byId.get("rec1").workflowStatus, "approved");
    assert.equal(storage.__byId.get("rec1").workflowDueDate, "2026-07-15");
    assert.equal(storage.__byId.get("rec1").workflowHistory.length, 2);

    // unknown record → 404; missing auth → 401
    const missing = await fetch(`${base}/api/workflow/transition`, {
      method: "POST",
      headers: { Authorization: bearer("admin"), "Content-Type": "application/json" },
      body: JSON.stringify({ id: "ghost", to: "review" }),
    });
    assert.equal(missing.status, 404);
    const anon = await fetch(`${base}/api/workflow/transition`, { method: "POST", body: "{}" });
    assert.equal(anon.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} workflow test(s) failed`); process.exit(1); }
  else console.log("\nAll workflow tests passed.");
});
