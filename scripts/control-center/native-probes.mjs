// This plan scopes native Windows to external Postgres/Redis only. These
// probes verify the operator-supplied endpoint is reachable; they never
// attempt to start a local database.
import { connect } from "node:net";

async function defaultTcpConnect(host, port, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port, timeout: timeoutMs });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); reject(new Error(`Connection to ${host}:${port} timed out`)); });
    socket.once("error", (error) => { socket.destroy(); reject(error); });
  });
}

export function createExternalOnlyProbes({ tcpConnect = defaultTcpConnect } = {}) {
  async function probeEndpoint(endpoint, label) {
    if (endpoint?.kind === "local-managed") {
      return { ok: false, code: "LOCAL_POSTGRES_UNAVAILABLE", message: `The locally managed ${label} runtime is not bundled in this build.` };
    }
    if (!endpoint?.host || !endpoint?.port) {
      return { ok: false, code: "ENDPOINT_NOT_CONFIGURED", message: `No ${label} endpoint configured.` };
    }
    try {
      await tcpConnect(endpoint.host, endpoint.port);
      return { ok: true };
    } catch (error) {
      return { ok: false, code: "ENDPOINT_UNREACHABLE", message: `${label} endpoint ${endpoint.host}:${endpoint.port} is unreachable: ${error.message}` };
    }
  }
  return {
    postgres: (endpoint) => probeEndpoint(endpoint, "PostgreSQL"),
    redis: (endpoint) => probeEndpoint(endpoint, "Redis"),
  };
}
