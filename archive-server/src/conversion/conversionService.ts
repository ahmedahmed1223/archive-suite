import { PrismaClient } from "../generated/prisma/client.js";

interface ConversionServiceDeps {
  db: PrismaClient | null;
}

interface RequestConversionParams {
  sourceItemId?: string;
  sourceKey: string;
  conversionType: string;
  label?: string;
  jobId?: string;
  createdBy?: string;
}

interface MarkCompletedParams {
  outputKey?: string;
  mimeType?: string;
  fileSizeBytes?: bigint;
}

// §16.15 — Conversion Service
// Wraps the existing media job queue (mediaJobs.js / runMedia.js) with
// persistent tracking in the `derived_files` Prisma table.
//
// Usage:
//   const svc = createConversionService({ db, mediaJobStore });
//   const record = await svc.requestConversion({ sourceItemId, sourceKey, conversionType, label, jobId, createdBy });
//   await svc.markCompleted(record.id, { outputKey, mimeType, fileSizeBytes });
//   await svc.markFailed(record.id, errorMessage);
//
// Each method gracefully no-ops when `db` is null so the server starts
// without a database (SPA/local mode).

/**
 * @param {{ db: import('../generated/prisma/client.js').PrismaClient | null }} deps
 */
export function createConversionService({ db }: ConversionServiceDeps = { db: null }) {
  /**
   * Create a pending derived_file record when a conversion job is submitted.
   */
  async function requestConversion(params: RequestConversionParams = { sourceKey: "", conversionType: "" }) {
    if (!db) return null;
    const { sourceItemId, sourceKey = "", conversionType = "", label = "", jobId, createdBy } = params;
    if (!sourceKey || !conversionType) {
      throw new Error("conversionService.requestConversion: sourceKey و conversionType مطلوبان.");
    }
    return (db as any).derivedFile.create({
      data: {
        sourceItemId: sourceItemId ?? null,
        sourceKey,
        conversionType,
        label,
        jobId: jobId ?? null,
        createdBy: createdBy ?? null,
        status: "pending"
      }
    });
  }

  /**
   * Update a derived_file record to completed once the media job finishes.
   */
  async function markCompleted(id: string, params: MarkCompletedParams = {}) {
    if (!db || !id) return null;
    const { outputKey, mimeType, fileSizeBytes } = params;
    return (db as any).derivedFile.update({
      where: { id },
      data: {
        status: "completed",
        outputKey: outputKey ?? null,
        mimeType: mimeType ?? null,
        fileSizeBytes: fileSizeBytes != null ? BigInt(fileSizeBytes) : null,
        completedAt: new Date()
      }
    });
  }

  /**
   * Mark a derived_file record as failed with the given error message.
   */
  async function markFailed(id: string, errorMessage: string = "") {
    if (!db || !id) return null;
    return (db as any).derivedFile.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: String(errorMessage).slice(0, 1000),
        completedAt: new Date()
      }
    });
  }

  /**
   * Mark in-progress — set status to "processing" once the job leaves the queue.
   */
  async function markProcessing(id: string) {
    if (!db || !id) return null;
    return (db as any).derivedFile.update({
      where: { id },
      data: { status: "processing" }
    });
  }

  /**
   * Retrieve all derived files for a given source item.
   */
  async function listForItem(sourceItemId: string) {
    if (!db || !sourceItemId) return [];
    return (db as any).derivedFile.findMany({
      where: { sourceItemId },
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Retrieve all derived files for a given source storage key.
   */
  async function listForKey(sourceKey: string) {
    if (!db || !sourceKey) return [];
    return (db as any).derivedFile.findMany({
      where: { sourceKey },
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Sync job status into the derived_file record when the job store reports
   * a completion. Intended to be called from the media job completion hook.
   */
  async function syncJobResult(jobId: string, params: { status: string; outputKey?: string; error?: string } = { status: "pending" }) {
    if (!db || !jobId) return;
    const { status = "pending", outputKey, error: errorMessage } = params;
    const record = await (db as any).derivedFile.findFirst({ where: { jobId } });
    if (!record) return;
    if (status === "done" || status === "completed") {
      await markCompleted(record.id, { outputKey });
    } else if (status === "error" || status === "failed") {
      await markFailed(record.id, errorMessage || "فشلت مهمة التحويل.");
    } else if (status === "running" || status === "processing") {
      await markProcessing(record.id);
    }
  }

  /**
   * Remove a derived_file record by id.
   * Caller is responsible for removing the file from FileStore.
   */
  async function remove(id: string) {
    if (!db || !id) return null;
    return (db as any).derivedFile.delete({ where: { id } });
  }

  return { requestConversion, markCompleted, markFailed, markProcessing, listForItem, listForKey, syncJobResult, remove };
}
