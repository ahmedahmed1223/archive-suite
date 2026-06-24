/**
 * tcpClient.js — MOS-over-TCP client (MOS 3.x, Slice 2).
 *
 * MOS protocol uses three persistent TCP connections:
 *   Port 10540 (Upper MOS)  — NCS → MOS (rundown commands)
 *   Port 10541 (Lower MOS)  — MOS → NCS (status/object responses)
 *   Port 10542 (High-pri)   — optional, time-critical messages
 *
 * This module manages ONE persistent connection (defaults to Upper port 10540).
 * Reconnect is automatic and silent on drop.  Messages queued while disconnected
 * are flushed on reconnect (oldest dropped when queue exceeds MAX_QUEUE_SIZE).
 *
 * Usage:
 *   import { createMosTcpClient } from "./tcpClient.js";
 *   const client = createMosTcpClient({ host, mosID, ncsID, onMessage });
 *   client.connect();
 */

import net from "node:net";
import { createMosSession } from "./session.js";

const MAX_QUEUE_SIZE = 100;
const CRLF = "\r\n";

/**
 * Build a MOS heartbeat XML string.
 *
 * @param {string} mosID
 * @param {string} ncsID
 * @param {number} messageID
 * @returns {string}
 */
function buildHeartbeat(mosID, ncsID, messageID) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<mos>\n` +
    `  <mosID>${mosID}</mosID>\n` +
    `  <ncsID>${ncsID}</ncsID>\n` +
    `  <messageID>${messageID}</messageID>\n` +
    `  <heartbeat/>\n` +
    `</mos>`
  );
}

/**
 * Create a MOS TCP client that manages one persistent connection.
 *
 * @param {object} opts
 * @param {string}   opts.host                  - NCS hostname/IP
 * @param {number}   [opts.port=10540]           - MOS Upper port
 * @param {string}   opts.mosID                  - our MOS device ID
 * @param {string}   opts.ncsID                  - NCS ID
 * @param {number}   [opts.reconnectDelayMs=5000]
 * @param {number}   [opts.heartbeatIntervalMs=30000]
 * @param {Function} [opts.onMessage]            - callback(parsedMessage)
 * @param {Function} [opts.onConnected]          - callback()
 * @param {Function} [opts.onDisconnected]       - callback(err?)
 * @returns {{ connect:Function, disconnect:Function, send:Function, getStatus:Function }}
 */
export function createMosTcpClient({
  host,
  port = 10540,
  mosID,
  ncsID,
  reconnectDelayMs = 5000,
  heartbeatIntervalMs = 30000,
  onMessage,
  onConnected,
  onDisconnected,
}) {
  if (!host) throw new Error("host is required for MOS TCP client");
  if (!mosID) throw new Error("mosID is required for MOS TCP client");
  if (!ncsID) throw new Error("ncsID is required for MOS TCP client");

  const session = createMosSession({ mosID, ncsID });

  let socket = null;
  let connected = false;
  let destroyed = false;          // set by disconnect() to suppress reconnect
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let receiveBuffer = "";
  const queue = [];               // messages queued while disconnected

  // ── Internal helpers ──────────────────────────────────────────────────────

  function clearTimers() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (connected && socket) {
        const xml = buildHeartbeat(mosID, ncsID, session.nextMessageID());
        writeToSocket(xml);
      }
    }, heartbeatIntervalMs);
  }

  function writeToSocket(xmlString) {
    if (!socket || !connected) return false;
    try {
      socket.write(xmlString + CRLF);
      return true;
    } catch (err) {
      console.error("[mos-tcp] write error:", err.message);
      return false;
    }
  }

  function flushQueue() {
    while (queue.length > 0 && connected) {
      const msg = queue.shift();
      writeToSocket(msg);
    }
  }

  /**
   * Split raw received data on \r\n or </mos> message boundaries.
   * Returns an array of complete MOS XML strings.
   */
  function extractMessages(data) {
    receiveBuffer += data;
    const messages = [];

    // Try splitting on </mos> boundary first (MOS standard)
    let idx;
    while ((idx = receiveBuffer.indexOf("</mos>")) !== -1) {
      const chunk = receiveBuffer.slice(0, idx + "</mos>".length).trim();
      receiveBuffer = receiveBuffer.slice(idx + "</mos>".length);
      if (chunk) messages.push(chunk);
    }

    return messages;
  }

  function handleIncomingData(rawChunk) {
    const messages = extractMessages(rawChunk.toString("utf8"));
    for (const xml of messages) {
      try {
        const parsed = session.unwrap(xml);
        if (typeof onMessage === "function") {
          onMessage(parsed);
        }
      } catch (err) {
        console.error("[mos-tcp] parse error:", err.message, "raw:", xml.slice(0, 120));
      }
    }
  }

  function scheduleReconnect() {
    if (destroyed) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!destroyed) {
        reconnectAttempts += 1;
        doConnect();
      }
    }, reconnectDelayMs);
  }

  function doConnect() {
    if (destroyed) return;

    receiveBuffer = "";
    const sock = new net.Socket();
    socket = sock;

    sock.on("connect", () => {
      if (destroyed) {
        sock.destroy();
        return;
      }
      connected = true;
      reconnectAttempts = 0;
      startHeartbeat();
      flushQueue();
      if (typeof onConnected === "function") onConnected();
    });

    sock.on("data", (chunk) => {
      handleIncomingData(chunk);
    });

    sock.on("close", (hadError) => {
      if (socket === sock) {
        connected = false;
        socket = null;
        clearTimers();
        if (typeof onDisconnected === "function") {
          onDisconnected(hadError ? new Error("socket closed with error") : undefined);
        }
        scheduleReconnect();
      }
    });

    sock.on("error", (err) => {
      // The 'close' event always follows 'error'; just log here.
      console.error(`[mos-tcp] socket error (${host}:${port}):`, err.message);
    });

    sock.connect({ host, port });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Establish the TCP connection.  Idempotent: if already connected, no-op.
   */
  function connect() {
    if (connected || (socket && !socket.destroyed)) return;
    destroyed = false;
    doConnect();
  }

  /**
   * Permanently close the connection and suppress all reconnect attempts.
   */
  function disconnect() {
    destroyed = true;
    clearTimers();
    connected = false;
    if (socket) {
      socket.destroy();
      socket = null;
    }
  }

  /**
   * Send an XML string over the TCP socket.
   * If not connected, queues the message (drops oldest when MAX_QUEUE_SIZE exceeded).
   *
   * @param {string} xmlString
   */
  function send(xmlString) {
    if (connected && socket) {
      writeToSocket(xmlString);
    } else {
      if (queue.length >= MAX_QUEUE_SIZE) {
        const dropped = queue.shift();
        console.error("[mos-tcp] queue full — dropped oldest message:", dropped.slice(0, 80));
      }
      queue.push(xmlString);
    }
  }

  /**
   * Return the current connection status snapshot.
   *
   * @returns {{ connected:boolean, host:string, port:number, reconnectAttempts:number, queueSize:number }}
   */
  function getStatus() {
    return {
      connected,
      host,
      port,
      reconnectAttempts,
      queueSize: queue.length,
    };
  }

  return { connect, disconnect, send, getStatus };
}
