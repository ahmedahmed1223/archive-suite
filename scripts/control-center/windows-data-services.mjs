// V1-210C: data services for Windows Native installs. PostgreSQL is either a
// locally managed instance under the install root or an external endpoint;
// queue and cache always run on the database baseline; a Redis-compatible
// endpoint is optional and only accepted after its probe succeeds. The gate
// runs BEFORE anything is installed, so an unhealthy endpoint blocks the
// install instead of producing a half-configured stack. Probes are injected
// (data-probes.mjs) so everything is unit-testable without live services.
const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;
const CREDENTIAL_OR_URL = /[:@/\\]/;

function fail(code, message, nextActions, details = {}) {
  return { ok: false, code, message, details, nextActions };
}

function validEndpoint(endpoint) {
  return typeof endpoint?.host === "string" && HOST.test(endpoint.host) && !CREDENTIAL_OR_URL.test(endpoint.host)
    && Number.isInteger(endpoint.port) && endpoint.port >= 1 && endpoint.port <= 65535;
}

// Resolves the requested configuration into a validated plan. Switching the
// option (local <-> external, redis on/off) is just resolving a new config —
// there is no hidden state to migrate here.
export function resolveWindowsDataPlan({ postgres, redis } = {}) {
  const kind = postgres?.kind;
  if (kind !== "local-managed" && kind !== "external") {
    return fail("DATA_POSTGRES_CHOICE_REQUIRED", "PostgreSQL must be either the locally managed instance or an external endpoint.", ["Set postgres.kind to \"local-managed\" or \"external\" and retry."]);
  }
  if (kind === "external" && (!validEndpoint(postgres) || typeof postgres.database !== "string" || !postgres.database.trim())) {
    return fail("DATA_POSTGRES_ENDPOINT_INVALID", "An external PostgreSQL endpoint needs a plain host, port, and database name without credentials.", ["Provide host, port, and database only; credentials belong in the environment."]);
  }
  if (redis?.enabled && !validEndpoint(redis)) {
    return fail("DATA_REDIS_ENDPOINT_INVALID", "The optional Redis-compatible endpoint needs a plain host and port without credentials.", ["Provide redis host and port only, or disable the redis option."]);
  }
  return {
    ok: true,
    plan: {
      postgres: kind === "external" ? { kind, host: postgres.host, port: postgres.port, database: postgres.database } : { kind },
      queue: "database",
      cache: "database",
      redis: redis?.enabled ? { enabled: true, host: redis.host, port: redis.port } : { enabled: false },
    },
  };
}

// The pre-install gate: starts the managed instance when chosen, then proves
// every selected endpoint healthy via the shared probes before install may
// continue. Any failure is returned as a stable code the adapter records.
export function createWindowsDataGate({ probes, startLocalPostgres } = {}) {
  if (!probes || typeof probes.postgres !== "function" || typeof probes.redis !== "function") throw new Error("Windows data gate requires postgres and redis probes.");
  return async function ensureDataServicesReady(plan) {
    if (!plan?.postgres?.kind) return fail("DATA_PLAN_REQUIRED", "A resolved data services plan is required before install.", ["Run resolveWindowsDataPlan on the setup configuration first."]);
    if (plan.postgres.kind === "local-managed") {
      if (typeof startLocalPostgres !== "function") return fail("LOCAL_POSTGRES_UNAVAILABLE", "The locally managed PostgreSQL runtime is not wired into this installer.", ["Choose an external PostgreSQL endpoint, or install a build that bundles the managed instance."]);
      try { await startLocalPostgres(); }
      catch { return fail("LOCAL_POSTGRES_START_FAILED", "The locally managed PostgreSQL instance could not be started.", ["Review the postgres service log under the install root, then retry the install."]); }
    }
    const postgresProbe = await probes.postgres();
    if (!postgresProbe.ok) {
      return fail("DATA_ENDPOINT_UNHEALTHY", "PostgreSQL is not healthy; the install is blocked before any service is created.", ["Fix the PostgreSQL endpoint (or the managed instance), verify with setup probes, then retry."], { backend: "postgres", probe: postgresProbe.code });
    }
    if (plan.redis.enabled) {
      const redisProbe = await probes.redis();
      if (!redisProbe.ok) {
        return fail("REDIS_ENDPOINT_UNHEALTHY", "The optional Redis-compatible endpoint failed its probe; the install is blocked.", ["Fix the Redis endpoint and retry, or disable the redis option to stay on the database baseline."], { backend: "redis", probe: redisProbe.code });
      }
    }
    return {
      ok: true,
      code: "DATA_SERVICES_READY",
      message: "Data services are verified and ready for the Windows Native install.",
      details: { postgres: plan.postgres.kind, queue: plan.queue, cache: plan.cache, redis: plan.redis.enabled },
      nextActions: [],
    };
  };
}
