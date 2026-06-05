import assert from "node:assert/strict";

import { createEventBus } from "../src/api/eventBus.js";
import { createApiServer } from "../src/api/server.js";
import { signJwt } from "../src/auth/jwt.js";

// Realtime sync tests — event bus (pure) + SSE endpoint (real stream over the
// wire) + push→broadcast fan-out. No real backend; sync provider is a fake.

let failures = 0;
function run(name, fn) {
  Promise.resolve().then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((err) => { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); });
}

const SECRET = "realtime-secret";

run("event bus — subscribe/publish/unsubscribe", () => {
  const bus = createEventBus();
  const seen = [];
  const off = bus.subscribe((p) => seen.push(p));
  assert.equal(bus.size, 1);
  bus.publish({ a: 1 });
  bus.publish({ a: 2 });
  assert.deepEqual(seen, [{ a: 1 }, { a: 2 }]);
  off();
  assert.equal(bus.size, 0);
  bus.publish({ a: 3 }); // no listeners → no throw
  assert.equal(seen.length, 2);
});

run("event bus — one bad listener never blocks others", () => {
  const bus = createEventBus();
  let good = 0;
  bus.subscribe(() => { throw new Error("boom"); });
  bus.subscribe(() => { good += 1; });
  bus.publish({});
  assert.equal(good, 1);
});

// Read a single SSE `data:` frame from a live stream, with a timeout guard.
async function readOneSseData(response, timeoutMs = 2000) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frame = buffer.split("\n\n").find((f) => f.startsWith("data:"));
    if (frame) {
      await reader.cancel();
      return JSON.parse(frame.slice("data:".length).trim());
    }
  }
  await reader.cancel();
  throw new Error("no SSE data frame received in time");
}

run("SSE — push broadcasts a change to a connected client", async () => {
  const bus = createEventBus();
  const syncProvider = { async pushChange(c) { return { pushed: true, change: c }; }, async pullSince() { return { items: [] }; } };
  const server = createApiServer({
    backend: "test",
    authSecret: SECRET,
    resolveSyncProvider: () => syncProvider,
    eventBus: bus,
    rateLimit: null
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = signJwt({ sub: "u1", role: "editor" }, SECRET);

  try {
    // Open the SSE stream (token via query param, like EventSource).
    const stream = await fetch(`${base}/api/sync/events?token=${token}`, {
      headers: { Accept: "text/event-stream" }
    });
    assert.equal(stream.status, 200);
    assert.match(stream.headers.get("content-type") || "", /text\/event-stream/);

    // Give the subscription a tick to register, then push from "another device".
    await new Promise((r) => setTimeout(r, 50));
    const dataPromise = readOneSseData(stream);
    await fetch(`${base}/api/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: "v1", title: "محدّث عبر جهاز آخر" })
    });
    const event = await dataPromise;
    assert.equal(event.type, "change");
    assert.equal(event.change.id, "v1");
    assert.equal(event.change.title, "محدّث عبر جهاز آخر");
  } finally {
    await new Promise((r) => server.close(r));
  }
});

run("SSE — rejects connection without a valid token", async () => {
  const server = createApiServer({
    backend: "test",
    authSecret: SECRET,
    eventBus: createEventBus(),
    rateLimit: null
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const noToken = await fetch(`${base}/api/sync/events`);
    assert.equal(noToken.status, 401);
    const badToken = await fetch(`${base}/api/sync/events?token=garbage`);
    assert.equal(badToken.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll realtime tests passed.");
});
