import { createMediaJobWorker, montageOutputKey, storeMontageOutput } from "../media/mediaJobs.js";

interface ConversionJobRunnerOptions {
  store?: unknown;
  eventBus?: unknown;
  conversionService?: unknown;
  resolveFileStore?: () => unknown;
  runMediaDerivativeImpl?: (opts: unknown) => Promise<unknown>;
  runExport?: (timeline: unknown, opts: unknown) => Promise<{ output: unknown }>;
  mediaRootDir?: string;
  concurrency?: number;
}

/**
 * Bridge §16.15 conversion records with the existing media job queue.
 *
 * The media queue remains the execution engine. This runner adds the missing
 * persistence lifecycle: queued jobs get marked processing when picked up, then
 * completed/failed when the queue publishes its final event.
 */
export function createConversionJobRunner(options: ConversionJobRunnerOptions = {}) {
  const publishAndSync = (payload: any) => {
    (options.eventBus as any)?.publish?.(payload);
    if (!payload?.job?.id) return;
    const status = payload.type === "media.job.done" ? "done" : "error";
    (options.conversionService as any)?.syncJobResult?.(payload.job.id, {
      status,
      outputKey: payload.job.outputKey,
      error: payload.job.error
    }).catch(() => {});
  };

  return createMediaJobWorker({
    store: options.store as any,
    eventBus: { publish: publishAndSync },
    fileStore: (options.resolveFileStore?.() ?? {}) as any,
    concurrency: options.concurrency || 1,
    runDerivative: async ({ job, onProgress }: any) => {
      await (options.conversionService as any)?.syncJobResult?.(job.id, { status: "processing" }).catch(() => {});
      const result = await options.runMediaDerivativeImpl?.({
        type: job.type === "transcode" ? "transcode" : job.type,
        key: job.sourceKey,
        params: job.params,
        fileStore: options.resolveFileStore?.(),
        onProgress
      });
      return { outputKey: (result as any)?.outputKey ?? null, url: (result as any)?.url ?? null };
    },
    runMontage: async ({ job }: any) => {
      await (options.conversionService as any)?.syncJobResult?.(job.id, { status: "processing" }).catch(() => {});
      const outputKey = String(job.params?.outputKey) || montageOutputKey(job);
      const result = await options.runExport?.(job.params?.timeline, { rootDir: options.mediaRootDir });
      return storeMontageOutput({ output: String(result?.output), outputKey, fileStore: options.resolveFileStore?.() ?? {} as any });
    }
  });
}
