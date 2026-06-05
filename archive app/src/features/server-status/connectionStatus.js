export const CONNECTION_STATES = Object.freeze(["local", "online", "degraded", "reconnecting", "offline"]);

export function normalizeConnectionState(value = "local") {
  return CONNECTION_STATES.includes(value) ? value : "local";
}

export function createConnectionStatusState(overrides = {}) {
  const now = overrides.lastCheckedAt || null;
  return {
    state: normalizeConnectionState(overrides.state || "local"),
    backend: overrides.backend || "local",
    engine: overrides.engine || "",
    lastLatencyMs: Number.isFinite(overrides.lastLatencyMs) ? Math.max(0, Math.round(overrides.lastLatencyMs)) : null,
    lastError: overrides.lastError || "",
    lastCheckedAt: now,
    health: overrides.health || null
  };
}

export function markLocal(state = {}, event = {}) {
  return createConnectionStatusState({
    ...state,
    state: "local",
    backend: "local",
    engine: event.localEngine || state.engine || "indexeddb",
    lastError: "",
    lastCheckedAt: event.checkedAt || new Date().toISOString()
  });
}

export function markOnline(state = {}, event = {}) {
  return createConnectionStatusState({
    ...state,
    state: "online",
    backend: event.backend || state.backend,
    engine: event.engine || state.engine,
    lastLatencyMs: event.latencyMs ?? event.lastLatencyMs ?? state.lastLatencyMs,
    lastError: "",
    lastCheckedAt: event.checkedAt || event.lastCheckedAt || new Date().toISOString(),
    health: event.health || state.health
  });
}

export function markDegraded(state = {}, event = {}) {
  return createConnectionStatusState({
    ...state,
    state: "degraded",
    backend: event.backend || state.backend,
    engine: event.engine || state.engine,
    lastLatencyMs: event.latencyMs ?? event.lastLatencyMs ?? state.lastLatencyMs,
    lastError: event.error || event.lastError || "Database health check failed",
    lastCheckedAt: event.checkedAt || event.lastCheckedAt || new Date().toISOString(),
    health: event.health || state.health
  });
}

export function markReconnecting(state = {}, event = {}) {
  return createConnectionStatusState({
    ...state,
    state: "reconnecting",
    backend: event.backend || state.backend,
    engine: event.engine || state.engine,
    lastError: event.error || event.lastError || state.lastError || "Reconnecting",
    lastCheckedAt: event.checkedAt || event.lastCheckedAt || new Date().toISOString()
  });
}

export function markOffline(state = {}, event = {}) {
  return createConnectionStatusState({
    ...state,
    state: "offline",
    backend: event.backend || state.backend,
    engine: event.engine || state.engine,
    lastError: event.error || event.lastError || "Server is unreachable",
    lastCheckedAt: event.checkedAt || event.lastCheckedAt || new Date().toISOString()
  });
}

export function statusFromHealth(health = {}, checkedAt = new Date().toISOString()) {
  const latencyMs = health?.db?.latencyMs ?? health?.latencyMs ?? null;
  const event = {
    backend: health.backend || "unknown",
    engine: health.engine || "",
    latencyMs,
    checkedAt,
    health
  };
  if (health?.db && health.db.ok === false) {
    return { type: "degraded", ...event, error: health.db.error || "Database is degraded" };
  }
  return { type: "online", ...event };
}

export function reduceConnectionStatus(state = createConnectionStatusState(), event = {}) {
  const type = event.type || "";
  if (type === "local") return markLocal(state, event);
  if (type === "online" || type === "rpc-success") return markOnline(state, event);
  if (type === "degraded") return markDegraded(state, event);
  if (type === "reconnecting" || type === "unauthorized") return markReconnecting(state, event);
  if (type === "offline" || type === "rpc-failure") return markOffline(state, event);
  if (type === "health") return reduceConnectionStatus(state, statusFromHealth(event.health, event.checkedAt));
  return createConnectionStatusState(state);
}

