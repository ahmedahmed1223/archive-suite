/**
 * tcpClient.ts — MOS-over-TCP client (MOS 3.x, Slice 2).
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

// ── Type definitions ──────────────────────────────────────────────────────────

interface ClientOptions {
  host: string;
  port?: number;
  mosID: string;
  ncsID: string;
  reconnectDelayMs?: number;
  heartbeatIntervalMs?: number;
  onMessage?: (msg: unknown) => void;
  onConnected?: () => void;
  onDisconnected?: (err?: Error) => void;
}

interface ClientStatus {
  connected: boolean;
  host: string;
  port: number;
  reconnectAttempts: number;
  queueSize: number;
}

interface MosTcpClient {
  connect: () => void;
  disconnect: () => void;
  send: (xmlString: string) => void;
  getStatus: () => ClientStatus;
}

/**
 * Build a MOS heartbeat XML string.
 */
function buildHeartbeat(mosID: string, ncsID: string, messageID: number): string {
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
}: ClientOptions): MosTcpClient {
  if (!host) throw new Error("host is required for MOS TCP client");
  if (!mosID) throw new Error("mosID is required for MOS TCP client");
  if (!ncsID) throw new Error("ncsID is required for MOS TCP client");

  const session = createMosSession({ mosID, ncsID });

  let socket: net.Socket | null = null;
  let connected = false;
  let destroyed = false;          // set by disconnect() to suppress reconnect
  let reconnectAttempts = 0;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let receiveBuffer = "";
  const queue: string[] = [];               // messages queued while disconnected

  // ── Internal helpers ──────────────────────────────────────────────────────

  function clearTimers(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat(): void {
    if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (connected && socket) {
        const xml = buildHeartbeat(mosID, ncsID, session.nextMessageID());
        writeToSocket(xml);
      }
    }, heartbeatIntervalMs);
  }

  function writeToSocket(xmlString: string): boolean {
    if (!socket || !connected) return false;
    try {
      socket.write(xmlString + CRLF);
      return true;
    } catch (err) {
      console.error("[mos-tcp] write error:", (err as Error).message);
      return false;
    }
  }

  function flushQueue(): void {
    while (queue.length > 0 && connected) {
      const msg = queue.shift();
      if (msg) writeToSocket(msg);
    }
  }

  /**
   * Split raw received data on \r\n or </mos> message boundaries.
   * Returns an array of complete MOS XML strings.
   */
  function extractMessages(data: Buffer | Uint8Array): string[] {
    receiveBuffer += typeof data === "string" ? data : data.toString("utf-8");
    const messages: string[] = [];

    // Try splitting on </mos> boundary first (MOS standard)
    let idx;
    while ((idx = receiveBuffer.indexOf("</mos>")) !== -1) {
      const chunk = receiveBuffer.slice(0, idx + "</mos>".length).trim();
      receiveBuffer = receiveBuffer.slice(idx + "</mos>".length);
      if (chunk) messages.push(chunk);
    }

    return messages;
  }

  function handleIncomingData(rawChunk: Buffer | Uint8Array): void {
    const messages = extractMessages(rawChunk);
    for (const xml of messages) {
      try {
        const parsed = session.unwrap(xml);
        if (typeof onMessage === "function") {
          onMessage(parsed);
        }
      } catch (err) {
        console.error("[mos-tcp] parse error:", (err as Error).message, "raw:", xml.slice(0, 120));
      }
    }
  }

  function scheduleReconnect(): void {
    if (destroyed) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!destroyed) {
        reconnectAttempts += 1;
        doConnect();
      }
    }, reconnectDelayMs);
  }

  function doConnect(): void {
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

    sock.on("data", (chunk: any) => {
      handleIncomingData(chunk as Buffer | Uint8Array);
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
      console.error(`[mos-tcp] socket error (${host}:${port}):`, (err as Error).message);
    });

    sock.connect({ host, port });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Establish the TCP connection.  Idempotent: if already connected, no-op.
   */
  function connect(): void {
    if (connected || (socket && !socket.destroyed)) return;
    destroyed = false;
    doConnect();
  }

  /**
   * Permanently close the connection and suppress all reconnect attempts.
   */
  function disconnect(): void {
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
   */
  function send(xmlString: string): void {
    if (connected && socket) {
      writeToSocket(xmlString);
    } else {
      if (queue.length >= MAX_QUEUE_SIZE) {
        const dropped = queue.shift();
        console.error("[mos-tcp] queue full — dropped oldest message:", dropped?.slice(0, 80));
      }
      queue.push(xmlString);
    }
  }

  /**
   * Return the current connection status snapshot.
   */
  function getStatus(): ClientStatus {
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
