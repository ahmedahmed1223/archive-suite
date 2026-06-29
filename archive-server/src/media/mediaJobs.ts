import fs from "node:fs/promises";
import path from "node:path";

import { runMediaDerivative } from "./runMedia.js";

const DONE_STATUSES = new Set(["done", "error"]);

export interface MediaJob {
  id: string;
  type: string;
  sourceKey: string;
  params: Record<string, unknown>;
  status: "queued" | "running" | "done" | "error";
  progress: number;
  outputKey: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  requestedBy: string;
}

export interface MediaJobStore {
  create(opts: { type: string; sourceKey?: string; params?: Record<string, unknown>; requestedBy?: string }): MediaJob;
  get(id: string): MediaJob | null;
  list(): MediaJob[];
  update(id: string, patch: Partial<Omit<MediaJob, "id">>): MediaJob | null;
  retry(id: string): MediaJob | null;
  nextQueued(): MediaJob | null;
}

export function createInMemoryMediaJobStore({ now = () => Date.now(), idFactory }: { now?: () => number; idFactory?: () => string } = {}): MediaJobStore {
  const jobs = new Map<string, MediaJob>();
  let seq = 0;
  const makeId = idFactory || (() => `media-${now().toString(36)}-${(++seq).toString(36)}`);

  function stamp(job: MediaJob, patch: Partial<Omit<MediaJob, "id">> = {}): MediaJob {
    return { ...job, ...patch, updatedAt: now() };
  }

  return {
    create(opts?: { type?: string; sourceKey?: string; params?: Record<string, unknown>; requestedBy?: string }) {
      const { type = "", sourceKey = "", params = {}, requestedBy = "" } = opts ?? {};
      const time = now();
      const job: MediaJob = {
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
        requestedBy
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
      return [...jobs.values()].find((job) => job.status === "queued") || null;
    }
  };
}

export function parseFfmpegProgress(text: string | unknown, durationSec: number | unknown): number | null {
  const duration = Number(durationSec);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const match = /time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(String(text || ""));
  if (!match) return null;
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Math.max(0, Math.min(99, Math.round((seconds / duration) * 100)));
}

interface MediaJobWorkerOptions {
  store: MediaJobStore;
  fileStore: { putBlob?: (key: string, data: Buffer, opts: any) => Promise<any> };
  concurrency?: number;
  eventBus?: { publish: (event: any) => void } | null;
  runDerivative?: (opts: any) => Promise<{ outputKey: string | null; url?: string | null }>;
  runMontage?: ((opts: any) => Promise<{ outputKey: string | null; url?: string | null }>) | null;
}

interface MediaJobWorker {
  pump(): Promise<void>;
}

export function createMediaJobWorker({
  store,
  fileStore,
  concurrency = 1,
  eventBus = null,
  runDerivative = defaultRunDerivative,
  runMontage = null
}: MediaJobWorkerOptions): MediaJobWorker {
  let active = 0;

  async function processJob(job: MediaJob): Promise<void> {
    active += 1;
    store.update(job.id, { status: "running", progress: Math.max(1, job.progress || 0), error: null });
    try {
      const onProgress = (value: number | string) => {
        const progress = typeof value === "number" ? value : parseFfmpegProgress(value, (job.params?.durationSec as number) ?? 0);
        if (progress !== null && progress !== undefined) store.update(job.id, { progress });
      };
      const result = job.type === "montage" && typeof runMontage === "function"
        ? await runMontage({ job, fileStore, onProgress })
        : await runDerivative({ job, fileStore, onProgress });
      const done = store.update(job.id, {
        status: "done",
        progress: 100,
        outputKey: result?.outputKey || null,
        error: null
      });
      if (eventBus && done) eventBus.publish({ type: "media.job.done", job: done });
    } catch (error) {
      const failed = store.update(job.id, {
        status: "error",
        error: (error as any)?.message || "Media job failed"
      });
      if (eventBus && failed) eventBus.publish({ type: "media.job.error", job: failed });
    } finally {
      active -= 1;
    }
  }

  return {
    async pump() {
      const running: Promise<void>[] = [];
      while (active < concurrency) {
        const job = store.nextQueued();
        if (!job) break;
        running.push(processJob(job));
      }
      await Promise.all(running);
      if (store.list().some((job) => job.status === "queued") && !store.list().every((job) => DONE_STATUSES.has(job.status))) {
        return this.pump();
      }
      return undefined;
    }
  };
}

async function defaultRunDerivative({ job, fileStore, onProgress }: any) {
  if (job.type !== "transcode") {
    throw new Error("نوع مهمة الوسائط غير مدعوم.");
  }
  return runMediaDerivative({
    type: "transcode",
    key: job.sourceKey,
    params: job.params,
    fileStore,
    onProgress
  });
}

export async function storeMontageOutput({ output, outputKey, fileStore }: { output: string; outputKey: string; fileStore: any }): Promise<{ outputKey: string; url: string | null }> {
  const bytes = await fs.readFile(output);
  await fileStore.putBlob(outputKey, bytes, { contentType: "video/mp4" });
  try { await fs.unlink(output); } catch { /* best effort */ }
  const url = typeof fileStore.getUrl === "function" ? await fileStore.getUrl(outputKey) : null;
  return { outputKey, url };
}

export function montageOutputKey(job: MediaJob): string {
  const title = String(job.params?.title || job.id || "montage").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "montage";
  return path.posix.join("derived", `${title}-montage.mp4`);
}
