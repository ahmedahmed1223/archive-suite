import {
  createConnectionStatusState,
  reduceConnectionStatus,
  statusFromHealth
} from "../../features/server-status/connectionStatus.js";

type StoreCtx = { set: any; get: () => any };

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

export function createConnectionStatusActions({ set, get }: StoreCtx) {
  const apply = (event: Record<string, any>) => {
    const next = reduceConnectionStatus(get().connectionStatus, event);
    set({ connectionStatus: next });
    return next;
  };
  return {
    setConnectionStatus: (event: Record<string, any> = {}) => apply(event),
    markConnectionLocal: (event: Record<string, any> = {}) => apply({ type: "local", ...event }),
    markRpcSuccess: (event: Record<string, any> = {}) => apply({ type: "rpc-success", ...event }),
    markRpcFailure: (event: Record<string, any> = {}) =>
      apply({ type: event.status === 401 ? "unauthorized" : "rpc-failure", ...event }),
    applyServerHealth: (health: Record<string, any> = {}) => apply(statusFromHealth(health, health.checkedAt))
  };
}
