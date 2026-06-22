/**
 * WebSocket presence server for real-time collaboration.
 *
 * Protocol (JSON messages):
 *   Client → Server:
 *     { type: "auth", token: "..." }          — authenticate
 *     { type: "focus", recordId: "..." }      — viewing a record
 *     { type: "blur", recordId: "..." }       — stopped viewing
 *     { type: "ping" }                        — keepalive
 *
 *   Server → Client:
 *     { type: "auth_ok", userId, username }   — auth success
 *     { type: "presence", viewers }           — presence list for a record
 *     { type: "conflict", recordId, editor }  — someone is editing what you're editing
 *     { type: "pong" }                        — keepalive response
 *     { type: "error", message }              — error
 */
import { WebSocketServer } from "ws";
import { createLogger } from "../logger.js";
import { config } from "../config/env.js";

const log = createLogger("presence");

// presence map: recordId → Set<{ userId, username, ws }>
const presence = new Map();
// client map: ws → { userId, username, focusedRecord }
const clients = new Map();

let wss = null;

export function startPresenceServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  log.info("WebSocket presence server started on /ws");

  wss.on("connection", (ws, req) => {
    log.debug({ ip: req.socket.remoteAddress }, "WS client connected (unauthenticated).");
    clients.set(ws, { userId: null, username: null, focusedRecord: null });

    // 15-second auth timeout
    const authTimeout = setTimeout(() => {
      if (!clients.get(ws)?.userId) {
        ws.close(4001, "Authentication timeout");
      }
    }, 15_000);

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      const client = clients.get(ws);
      if (!client) return;

      switch (msg.type) {
        case "auth":
          handleAuth(ws, client, msg.token, authTimeout);
          break;
        case "focus":
          if (client.userId && msg.recordId) handleFocus(ws, client, String(msg.recordId));
          break;
        case "blur":
          if (client.userId) handleBlur(ws, client);
          break;
        case "ping":
          safeSend(ws, { type: "pong" });
          break;
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      const client = clients.get(ws);
      if (client?.focusedRecord) removeFromPresence(ws, client);
      clients.delete(ws);
    });

    ws.on("error", (err) => log.warn({ err: err.message }, "WS error."));
  });
}

async function handleAuth(ws, client, token, authTimeout) {
  try {
    const { verifyJwt } = await import("../auth/jwt.js");
    const secret = config.jwtAuthSecret || config.jwtSecret;
    const payload = verifyJwt(token, secret);
    client.userId = payload.sub;
    client.username = payload.username || payload.sub;
    clearTimeout(authTimeout);
    safeSend(ws, { type: "auth_ok", userId: client.userId, username: client.username });
    log.debug({ userId: client.userId }, "WS client authenticated.");
  } catch {
    safeSend(ws, { type: "error", message: "فشل التحقق من الهوية." });
    ws.close(4003, "Unauthorized");
  }
}

function handleFocus(ws, client, recordId) {
  // Remove from old record
  if (client.focusedRecord) removeFromPresence(ws, client);
  // Add to new record
  client.focusedRecord = recordId;
  if (!presence.has(recordId)) presence.set(recordId, new Set());
  presence.get(recordId).add({ userId: client.userId, username: client.username, ws });
  broadcastPresence(recordId);
}

function handleBlur(ws, client) {
  if (client.focusedRecord) {
    removeFromPresence(ws, client);
    client.focusedRecord = null;
  }
}

function removeFromPresence(ws, client) {
  const recordId = client.focusedRecord;
  if (!recordId) return;
  const viewers = presence.get(recordId);
  if (viewers) {
    for (const v of viewers) { if (v.ws === ws) { viewers.delete(v); break; } }
    if (viewers.size === 0) presence.delete(recordId);
    else broadcastPresence(recordId);
  }
}

function broadcastPresence(recordId) {
  const viewers = presence.get(recordId);
  if (!viewers) return;
  // Expose only `username` to other clients — omit `userId` to prevent user-ID
  // enumeration via arbitrary recordId subscription (IDOR mitigation).
  const list = [...viewers].map(v => ({ username: v.username }));
  for (const v of viewers) {
    safeSend(v.ws, { type: "presence", recordId, viewers: list });
  }
}

function safeSend(ws, data) {
  try {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
  } catch { /* ignore */ }
}

/** Get current presence count for a record (for HTTP API) */
export function getPresenceCount(recordId) {
  return presence.get(recordId)?.size ?? 0;
}
