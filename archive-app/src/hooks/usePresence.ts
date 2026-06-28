import { useState, useEffect, useRef, useCallback } from "react";

interface PresenceViewer {
  userId?: string;
  username?: string;
}

interface UsePresenceOptions {
  recordId?: string | null;
  authToken?: string | null;
  enabled?: boolean;
}

const WS_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
    : null;

export function usePresence({ recordId, authToken, enabled = true }: UsePresenceOptions = {}) {
  const [viewers, setViewers] = useState<PresenceViewer[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const connect = useCallback(() => {
    if (!WS_URL || !authToken || !enabled) return undefined;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCountRef.current = 0;
      setConnected(true);
      ws.send(JSON.stringify({ type: "auth", token: authToken }));
      if (recordId) ws.send(JSON.stringify({ type: "focus", recordId }));
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as {
          type?: string;
          recordId?: string;
          viewers?: PresenceViewer[];
        };
        if (msg.type === "presence" && msg.recordId === recordId) {
          setViewers(msg.viewers ?? []);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setViewers([]);
      const delay = Math.min(1000 * 2 ** retryCountRef.current, 60_000);
      retryCountRef.current += 1;
      reconnectRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }, 25_000);

    return () => clearInterval(ping);
  }, [authToken, enabled, recordId]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      cleanup?.();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

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
