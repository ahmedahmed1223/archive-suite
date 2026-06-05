import {
  createConnectionStatusState,
  reduceConnectionStatus,
  statusFromHealth
} from "../../features/server-status/connectionStatus.js";

export const connectionStatusInitialState = {
  connectionStatus: createConnectionStatusState()
};

export const connectionStatusActionKeys = [
  "setConnectionStatus",
  "markConnectionLocal",
  "markRpcSuccess",
  "markRpcFailure",
  "applyServerHealth"
];

export function createConnectionStatusActions({ set, get }) {
  const apply = (event) => {
    const next = reduceConnectionStatus(get().connectionStatus, event);
    set({ connectionStatus: next });
    return next;
  };
  return {
    setConnectionStatus: (event = {}) => apply(event),
    markConnectionLocal: (event = {}) => apply({ type: "local", ...event }),
    markRpcSuccess: (event = {}) => apply({ type: "rpc-success", ...event }),
    markRpcFailure: (event = {}) => apply({ type: event.status === 401 ? "unauthorized" : "rpc-failure", ...event }),
    applyServerHealth: (health = {}) => apply(statusFromHealth(health, health.checkedAt))
  };
}

