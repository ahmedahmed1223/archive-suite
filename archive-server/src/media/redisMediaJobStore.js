/**
 * Redis-persisted media job store.
 *
 * Wraps the in-memory store to add durable persistence:
 *   - On startup: reloads queued/running jobs from Redis.
 *   - After every write: persists to Redis asynchronously (fire-and-forget).
 *   - Prunes completed/errored jobs older than 7 days hourly.
 *
 * This keeps the synchronous API of createInMemoryMediaJobStore() intact
 * so no changes are required in server.js or the media worker.
 *
 * Priority queue ordering:  probe (3) > thumbnail (2) > transcode (1).
 */

import { createLogger } from "../logger.js";
import { createInMemoryMediaJobStore } from "./mediaJobs.js";

const log = createLogger("redis-media-jobs");

const KEY_PREFIX  = "archive:media:";
const JOBS_SET    = `${KEY_PREFIX}jobs`;
const jobKey      = (id) => `${KEY_PREFIX}job:${id}`;

const PRIORITY_ORDER = { probe: 0, thumbnail: 1, transcode: 2 };

function serializeJob(job) {
  return {
    id:          String(job.id),
    type:        String(job.type),
    sourceKey:   String(job.sourceKey ?? ""),
    params:      JSON.stringify(job.params ?? {}),
    status:      String(job.status),
    progress:    String(job.progress ?? 0),
    outputKey:   job.outputKey != null ? String(job.outputKey) : "",
    error:       job.error != null ? String(job.error) : "",
    createdAt:   String(job.createdAt),
    updatedAt:   String(job.updatedAt),
    requestedBy: String(job.requestedBy ?? ""),
  };
}

function deserializeJob(raw) {
  if (!raw || Object.keys(raw).length === 0) return null;
  return {
    id:          raw.id,
    type:        raw.type,
    sourceKey:   raw.sourceKey,
    params:      (() => { try { return JSON.parse(raw.params); } catch { return {}; } })(),
    status:      raw.status,
    progress:    Number(raw.progress ?? 0),
    outputKey:   raw.outputKey || null,
    error:       raw.error || null,
    createdAt:   Number(raw.createdAt),
    updatedAt:   Number(raw.updatedAt),
    requestedBy: raw.requestedBy ?? "",
  };
}

function persist(redis, job) {
  const pl = redis.pipeline();
  pl.hset(jobKey(job.id), serializeJob(job));
  pl.sadd(JOBS_SET, job.id);
  pl.exec().catch((err) => log.warn({ err: err.message }, "Redis persist error."));
}

function remove(redis, id) {
  redis.pipeline()
    .del(jobKey(id))
    .srem(JOBS_SET, id)
    .exec()
    .catch((err) => log.warn({ err: err.message }, "Redis remove error."));
}

/**
 * Load queued/running jobs from Redis and inject them into the given store so
 * they resume after a server restart. Returns the number of jobs restored.
 */
async function restoreFromRedis(redis, store) {
  const ids = await redis.smembers(JOBS_SET);
  if (!ids.length) return 0;

  const pl = redis.pipeline();
  ids.forEach((id) => pl.hgetall(jobKey(id)));
  const results = await pl.exec();

  const jobs = results
    .map(([, raw]) => deserializeJob(raw))
    .filter((j) => j && (j.status === "queued" || j.status === "running"));

  // Sort: priority first, then oldest first within same type.
  jobs.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.type] ?? 2;
    const pb = PRIORITY_ORDER[b.type] ?? 2;
    if (pa !== pb) return pa - pb;
    return a.createdAt - b.createdAt;
  });

  for (const job of jobs) {
    // Reset "running" jobs to "queued" — they never finished before restart.
    const restored = { ...job, status: "queued", progress: 0 };
    store._inject(restored);
  }
  return jobs.length;
}

/**
 * Wrap an in-memory store so every mutation also persists to Redis.
 * The returned store has the same synchronous API.
 */
function wrapWithPersistence(inner, redis, pruneFn) {
  return {
    create(...args) {
      const job = inner.create(...args);
      persist(redis, job);
      return job;
    },
    get(id) {
      return inner.get(id);
    },
    list() {
      return inner.list();
    },
    update(id, patch) {
      const job = inner.update(id, patch);
      if (job) persist(redis, job);
      return job;
    },
    retry(id) {
      const job = inner.retry(id);
      if (job) persist(redis, job);
      return job;
    },
    nextQueued() {
      return inner.nextQueued();
    },
  };
}

/**
 * Try to create a Redis-persisted media job store.
 *
 * Returns a store with the same synchronous API as createInMemoryMediaJobStore(),
 * backed by Redis for durability. Returns null when REDIS_URL is not set or
 * Redis is unreachable — callers should fall back to createInMemoryMediaJobStore().
 *
 * @param {object} [opts] - Forwarded to createInMemoryMediaJobStore().
 */
export async function tryCreateRedisMediaJobStore(opts = {}) {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  let redis;
  try {
    const { default: Redis } = await import("ioredis");
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 3_000,
    });
    await redis.connect();
    await redis.ping();
    log.info("Redis media job store connected.");
  } catch (err) {
    log.warn({ err: err.message }, "Redis unavailable — media jobs will use in-memory store.");
    return null;
  }

  redis.on("error", (err) => {
    log.warn({ err: err.message }, "Redis media job store error (persistence may be degraded).");
  });

  // Extend the in-memory store with an _inject method for restoration.
  const inner = createInMemoryMediaJobStore(opts);
  // _inject: add a job directly (bypassing ID generation) for restore use.
  inner._inject = function (job) {
    this._jobs = this._jobs || new Map();
    this._jobs.set(job.id, job);
  };

  // Re-create with injection support (in-memory store uses closure; patch map).
  const innerWithInject = _createInjectableStore(opts);

  // Restore persisted jobs from Redis.
  let restored = 0;
  try {
    restored = await restoreFromRedis(redis, innerWithInject);
    if (restored > 0) {
      log.info({ restored }, "Restored media jobs from Redis after restart.");
    }
  } catch (err) {
    log.warn({ err: err.message }, "Could not restore jobs from Redis.");
  }

  const store = wrapWithPersistence(innerWithInject, redis);

  // Prune completed/errored jobs older than 7 days hourly.
  async function prune() {
    const ids = await redis.smembers(JOBS_SET);
    if (!ids.length) return;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const pl = redis.pipeline();
    ids.forEach((id) => pl.hgetall(jobKey(id)));
    const results = await pl.exec();
    const toDelete = [];
    results.forEach(([, raw], i) => {
      const job = deserializeJob(raw);
      const terminal = !job || job.status === "done" || job.status === "error";
      if (terminal && (!job || job.updatedAt < cutoff)) toDelete.push(ids[i]);
    });
    if (!toDelete.length) return;
    const delPl = redis.pipeline();
    toDelete.forEach((id) => { delPl.del(jobKey(id)); delPl.srem(JOBS_SET, id); });
    await delPl.exec();
    log.debug({ pruned: toDelete.length }, "Pruned old media jobs from Redis.");
  }

  const timer = setInterval(() => {
    prune().catch((err) => log.warn({ err: err.message }, "Media job prune failed."));
  }, 60 * 60 * 1000);
  if (timer.unref) timer.unref();

  return store;
}

/**
 * An in-memory store that exposes the internal jobs Map so we can inject
 * restored jobs without re-entering the create() path (which generates new IDs).
 */
function _createInjectableStore(opts = {}) {
  const { now = () => Date.now(), idFactory } = opts;
  const jobs = new Map();
  let seq = 0;
  const makeId = idFactory || (() => `media-${now().toString(36)}-${(++seq).toString(36)}`);

  const DONE = new Set(["done", "error"]);

  function stamp(job, patch = {}) {
    return { ...job, ...patch, updatedAt: now() };
  }

  return {
    _inject(job) {
      jobs.set(job.id, job);
    },
    create({ type, sourceKey = "", params = {}, requestedBy = "" } = {}) {
      const time = now();
      const job = {
        id: makeId(),
        type,
        sourceKey,
        params,
        status: "queued",
        progress: 0,
        outputKey: null,
        error: null,
        createdAt: time,
        updatedAt: time,
        requestedBy,
      };
      jobs.set(job.id, job);
      return job;
    },
    get(id) {
      return jobs.get(id) || null;
    },
    list() {
      return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
    },
    update(id, patch) {
      const existing = jobs.get(id);
      if (!existing) return null;
      const next = stamp(existing, patch);
      jobs.set(id, next);
      return next;
    },
    retry(id) {
      const existing = jobs.get(id);
      if (!existing || existing.status !== "error") return null;
      return this.update(id, { status: "queued", progress: 0, error: null, outputKey: null });
    },
    nextQueued() {
      // Priority: probe first, then thumbnail, then transcode; oldest wins within type.
      const queued = [...jobs.values()]
        .filter((j) => j.status === "queued")
        .sort((a, b) => {
          const pa = PRIORITY_ORDER[a.type] ?? 2;
          const pb = PRIORITY_ORDER[b.type] ?? 2;
          if (pa !== pb) return pa - pb;
          return a.createdAt - b.createdAt;
        });
      return queued[0] || null;
    },
  };
}
