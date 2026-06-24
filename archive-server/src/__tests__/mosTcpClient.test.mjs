/**
 * mosTcpClient.test.mjs — integration tests for tcpClient.js
 *
 * Uses node:net to spin up a local TCP server (no mocking).
 * 8 tests covering the full public API contract.
 */

import { test, describe, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";

import { createMosTcpClient } from "../integrations/mos/tcpClient.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOS_ID = "ARCHIVE.TEST.1";
const NCS_ID = "ENPS.TEST.1";

/**
 * Start a local TCP server that echoes every received chunk back.
 * Returns { server, port, close }.
 */
function startEchoServer() {
  return new Promise((resolve) => {
    const received = [];
    const server = net.createServer((sock) => {
      sock.on("data", (chunk) => {
        received.push(chunk.toString("utf8"));
        sock.write(chunk); // echo back
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
        port,
        received,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

/**
 * Wait until predicate() returns truthy, polling every 20 ms.
 * Rejects after timeoutMs.
 */
function waitUntil(predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const id = setInterval(() => {
      if (predicate()) {
        clearInterval(id);
        resolve();
      } else if (Date.now() > deadline) {
        clearInterval(id);
        reject(new Error(`waitUntil timed out after ${timeoutMs} ms`));
      }
    }, 20);
  });
}

// ── Test 1 — factory returns expected shape ───────────────────────────────────

test("createMosTcpClient returns object with connect/disconnect/send/getStatus", () => {
  const client = createMosTcpClient({
    host: "127.0.0.1", port: 19540,
    mosID: MOS_ID, ncsID: NCS_ID,
  });
  assert.equal(typeof client.connect, "function");
  assert.equal(typeof client.disconnect, "function");
  assert.equal(typeof client.send, "function");
  assert.equal(typeof client.getStatus, "function");
  // Clean up — no connection was opened so this is safe
  client.disconnect();
});

// ── Test 2 — getStatus before connect ────────────────────────────────────────

test("getStatus before connect returns connected:false", () => {
  const client = createMosTcpClient({
    host: "127.0.0.1", port: 19541,
    mosID: MOS_ID, ncsID: NCS_ID,
  });
  const status = client.getStatus();
  assert.equal(status.connected, false);
  assert.equal(status.queueSize, 0);
  client.disconnect();
});

// ── Test 3 — connect to local echo server → connected:true ───────────────────

test("after connect() to local echo server getStatus().connected === true", async () => {
  const { port, close } = await startEchoServer();
  const client = createMosTcpClient({
    host: "127.0.0.1", port,
    mosID: MOS_ID, ncsID: NCS_ID,
    reconnectDelayMs: 200,
    heartbeatIntervalMs: 60000,
  });
  try {
    client.connect();
    await waitUntil(() => client.getStatus().connected);
    assert.equal(client.getStatus().connected, true);
  } finally {
    client.disconnect();
    await close();
  }
});

// ── Test 4 — send() delivers data to the local server ────────────────────────

test("send() delivers XML data to the connected server", async () => {
  const { port, received, close } = await startEchoServer();
  const client = createMosTcpClient({
    host: "127.0.0.1", port,
    mosID: MOS_ID, ncsID: NCS_ID,
    reconnectDelayMs: 200,
    heartbeatIntervalMs: 60000,
  });
  try {
    client.connect();
    await waitUntil(() => client.getStatus().connected);

    const xml = `<?xml version="1.0"?><mos><mosID>${MOS_ID}</mosID><ncsID>${NCS_ID}</ncsID><messageID>1</messageID><heartbeat/></mos>`;
    client.send(xml);

    await waitUntil(() => received.some((r) => r.includes("<heartbeat")));
    assert.ok(received.some((r) => r.includes("<heartbeat")), "server should have received the XML");
  } finally {
    client.disconnect();
    await close();
  }
});

// ── Test 5 — disconnect() sets connected:false and suppresses reconnect ───────

test("disconnect() sets connected:false and suppresses reconnect", async () => {
  const { port, close } = await startEchoServer();
  const client = createMosTcpClient({
    host: "127.0.0.1", port,
    mosID: MOS_ID, ncsID: NCS_ID,
    reconnectDelayMs: 100,
    heartbeatIntervalMs: 60000,
  });
  try {
    client.connect();
    await waitUntil(() => client.getStatus().connected);

    client.disconnect();
    assert.equal(client.getStatus().connected, false);

    // Wait longer than reconnectDelayMs; connected must stay false
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(client.getStatus().connected, false);
  } finally {
    await close();
  }
});

// ── Test 6 — messages queued while disconnected are sent on reconnect ─────────

test("messages queued while disconnected are flushed on reconnect", async () => {
  const { port, received, close } = await startEchoServer();

  // Create client but don't connect yet
  const client = createMosTcpClient({
    host: "127.0.0.1", port,
    mosID: MOS_ID, ncsID: NCS_ID,
    reconnectDelayMs: 200,
    heartbeatIntervalMs: 60000,
  });

  const sentXml = `<?xml version="1.0"?><mos><mosID>${MOS_ID}</mosID><ncsID>${NCS_ID}</ncsID><messageID>42</messageID><roReq><roID>RO.QUEUED</roID></roReq></mos>`;

  // Queue message while disconnected
  client.send(sentXml);
  assert.equal(client.getStatus().queueSize, 1, "message should be queued");

  try {
    // Now connect — queue should be flushed
    client.connect();
    await waitUntil(() => client.getStatus().connected);
    await waitUntil(() => received.some((r) => r.includes("RO.QUEUED")), 2000);

    assert.ok(received.some((r) => r.includes("RO.QUEUED")), "queued message should be delivered after connect");
    assert.equal(client.getStatus().queueSize, 0, "queue should be empty after flush");
  } finally {
    client.disconnect();
    await close();
  }
});

// ── Test 7 — heartbeat sent at interval ──────────────────────────────────────

test("heartbeat message is sent at the configured interval", async () => {
  const { port, received, close } = await startEchoServer();
  const client = createMosTcpClient({
    host: "127.0.0.1", port,
    mosID: MOS_ID, ncsID: NCS_ID,
    reconnectDelayMs: 200,
    heartbeatIntervalMs: 150,  // very short for test speed
  });
  try {
    client.connect();
    await waitUntil(() => client.getStatus().connected);

    // Wait for at least one heartbeat to fire (interval = 150 ms)
    await waitUntil(() => received.some((r) => r.includes("<heartbeat")), 1500);
    assert.ok(received.some((r) => r.includes("<heartbeat")), "heartbeat should be received");
  } finally {
    client.disconnect();
    await close();
  }
});

// ── Test 8 — onMessage callback fires when server sends data ─────────────────

test("onMessage callback fires when server sends data back", async () => {
  const { port, close } = await startEchoServer();

  const receivedMessages = [];
  const client = createMosTcpClient({
    host: "127.0.0.1", port,
    mosID: MOS_ID, ncsID: NCS_ID,
    reconnectDelayMs: 200,
    heartbeatIntervalMs: 60000,
    onMessage: (msg) => receivedMessages.push(msg),
  });

  try {
    client.connect();
    await waitUntil(() => client.getStatus().connected);

    // Send a valid MOS envelope — echo server reflects it back → onMessage fires
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<mos>\n` +
      `  <mosID>${MOS_ID}</mosID>\n` +
      `  <ncsID>${NCS_ID}</ncsID>\n` +
      `  <messageID>7</messageID>\n` +
      `  <heartbeat/>\n` +
      `</mos>`;

    client.send(xml);

    await waitUntil(() => receivedMessages.length > 0, 2000);
    assert.ok(receivedMessages.length > 0, "onMessage should have been called");
    assert.equal(receivedMessages[0].mosID, MOS_ID);
  } finally {
    client.disconnect();
    await close();
  }
});
