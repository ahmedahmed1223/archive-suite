import { createMediaJobWorker, montageOutputKey, storeMontageOutput } from "../media/mediaJobs.js";

/**
 * Bridge §16.15 conversion records with the existing media job queue.
 *
 * The media queue remains the execution engine. This runner adds the missing
 * persistence lifecycle: queued jobs get marked processing when picked up, then
 * completed/failed when the queue publishes its final event.
 */
export function createConversionJobRunner({
  store,
  eventBus = null,
  conversionService,
  resolveFileStore,
  runMediaDerivativeImpl,
  runExport,
  mediaRootDir,
  concurrency = 1
} = {}) {
  const publishAndSync = (payload) => {
    eventBus?.publish?.(payload);
    if (!payload?.job?.id) return;
    const status = payload.type === "media.job.done" ? "done" : "error";
    conversionService?.syncJobResult?.(payload.job.id, {
      status,
      outputKey: payload.job.outputKey,
      error: payload.job.error
    }).catch(() => {});
  };

  return createMediaJobWorker({
    store,
    eventBus: { publish: publishAndSync },
    fileStore: resolveFileStore?.(),
    concurrency,
    runDerivative: async ({ job, onProgress }) => {
      await conversionService?.syncJobResult?.(job.id, { status: "processing" }).catch(() => {});
      return runMediaDerivativeImpl({
        type: job.type === "transcode" ? "transcode" : job.type,
        key: job.sourceKey,
        params: job.params,
        fileStore: resolveFileStore?.(),
        onProgress
      });
    },
    runMontage: async ({ job }) => {
      await conversionService?.syncJobResult?.(job.id, { status: "processing" }).catch(() => {});
      const outputKey = job.params?.outputKey || montageOutputKey(job);
      const result = await runExport(job.params?.timeline, { rootDir: mediaRootDir });
      return storeMontageOutput({ output: result.output, outputKey, fileStore: resolveFileStore?.() });
    }
  });
}
