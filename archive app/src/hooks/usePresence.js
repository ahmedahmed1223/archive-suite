/**
 * Real-time presence hook — connects to WebSocket server and tracks
 * who's viewing the same record.
 *
 * Returns: { viewers: [{userId, username}], connected, error }
 */
import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = typeof window !== "undefined"
  ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
  : null;

export function usePresence({ recordId, authToken, enabled = true } = {}) {
  const [viewers, setViewers] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const connect = useCallback(() => {
    if (!WS_URL || !authToken || !enabled) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "auth", token: authToken }));
      if (recordId) ws.send(JSON.stringify({ type: "focus", recordId }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "presence" && msg.recordId === recordId) {
          setViewers(msg.viewers ?? []);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setConnected(false);
      setViewers([]);
      // Reconnect after 3s
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();

    // Keepalive ping every 25s
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }, 25_000);

    return () => clearInterval(ping);
  }, [authToken, enabled, recordId]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      clearTimeout(reconnectRef.current);
      cleanup?.();
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  // When recordId changes, send blur/focus
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "focus", recordId }));
    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "blur" }));
    };
  }, [recordId]);

  return { viewers, connected };
}
