// External probes verify operator-supplied endpoints and never start a local
// database. Managed Native probes are defined below and target only the
// loopback services created from the verified bundle payload.
import { connect } from "node:net";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

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

function defaultRun(args, options = {}) {
  const result = spawnSync(args[0], args.slice(1), { stdio: "pipe", encoding: "utf8", ...options });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

// Probes used after the bundled data service has been provisioned. PostgreSQL
// is checked with its own client (including a real SQL query and the vector
// extension query), while Redis is checked at the loopback socket boundary.
// Secrets are supplied through the process environment only.
export function createManagedNativeProbes({ platform, installRoot, secrets, tcpConnect = defaultTcpConnect, run = defaultRun } = {}) {
  if (platform !== "windows-native" && platform !== "linux-native") throw new Error("Managed Native probes require a Native platform.");
  if (typeof installRoot !== "string" || !installRoot.trim()) throw new Error("Managed Native probes require an install root.");
  const resolvedSecrets = typeof secrets === "function" ? secrets() : secrets;
  const postgresBin = platform === "windows-native" ? join(installRoot, "runtime", "postgres", "bin") : join(installRoot, "runtime", "postgres", "bin");
  const executable = (name) => join(postgresBin, platform === "windows-native" ? `${name}.exe` : name);
  const postgres = async () => {
    const result = run([executable("psql"), "-h", "127.0.0.1", "-p", "5432", "-U", "archive_owner", "-d", "postgres", "-tAc", "SELECT 1"], { env: { PGPASSWORD: resolvedSecrets?.dbOwnerPassword } });
    return result.status === 0 ? { ok: true, code: "POSTGRES_READY" } : { ok: false, code: "POSTGRES_QUERY_FAILED", message: "Bundled PostgreSQL did not answer a readiness query." };
  };
  const pgvector = async () => {
    const result = run([executable("psql"), "-h", "127.0.0.1", "-p", "5432", "-U", "archive_owner", "-d", "archive", "-tAc", "SELECT extversion FROM pg_extension WHERE extname = 'vector'"], { env: { PGPASSWORD: resolvedSecrets?.dbOwnerPassword } });
    return result.status === 0 && String(result.stdout || "").trim() ? { ok: true, code: "PGVECTOR_READY" } : { ok: false, code: "PGVECTOR_QUERY_FAILED", message: "The bundled pgvector extension is not available in PostgreSQL." };
  };
  const redis = async () => {
    try {
      await tcpConnect("127.0.0.1", 6379);
      return { ok: true, code: "REDIS_READY" };
    } catch (error) {
      return { ok: false, code: "REDIS_UNREACHABLE", message: `Bundled Redis-compatible service is unreachable: ${error.message}` };
    }
  };
  return { postgres, pgvector, redis };
}
