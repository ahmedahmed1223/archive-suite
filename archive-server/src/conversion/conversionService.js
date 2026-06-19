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
export function createConversionService({ db } = {}) {
  /**
   * Create a pending derived_file record when a conversion job is submitted.
   *
   * @param {{
   *   sourceItemId: string,
   *   sourceKey: string,
   *   conversionType: string,
   *   label?: string,
   *   jobId?: string,
   *   createdBy?: string,
   * }} params
   * @returns {Promise<object|null>} Prisma DerivedFile record, or null if no DB.
   */
  async function requestConversion({ sourceItemId, sourceKey, conversionType, label = "", jobId, createdBy } = {}) {
    if (!db) return null;
    if (!sourceKey || !conversionType) {
      throw new Error("conversionService.requestConversion: sourceKey و conversionType مطلوبان.");
    }
    return db.derivedFile.create({
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
   *
   * @param {string} id  DerivedFile record id.
   * @param {{ outputKey: string, mimeType?: string, fileSizeBytes?: bigint }} params
   */
  async function markCompleted(id, { outputKey, mimeType, fileSizeBytes } = {}) {
    if (!db || !id) return null;
    return db.derivedFile.update({
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
   *
   * @param {string} id
   * @param {string} errorMessage
   */
  async function markFailed(id, errorMessage = "") {
    if (!db || !id) return null;
    return db.derivedFile.update({
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
   *
   * @param {string} id
   */
  async function markProcessing(id) {
    if (!db || !id) return null;
    return db.derivedFile.update({
      where: { id },
      data: { status: "processing" }
    });
  }

  /**
   * Retrieve all derived files for a given source item.
   *
   * @param {string} sourceItemId
   * @returns {Promise<object[]>}
   */
  async function listForItem(sourceItemId) {
    if (!db || !sourceItemId) return [];
    return db.derivedFile.findMany({
      where: { sourceItemId },
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Retrieve all derived files for a given source storage key.
   *
   * @param {string} sourceKey
   * @returns {Promise<object[]>}
   */
  async function listForKey(sourceKey) {
    if (!db || !sourceKey) return [];
    return db.derivedFile.findMany({
      where: { sourceKey },
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Sync job status into the derived_file record when the job store reports
   * a completion. Intended to be called from the media job completion hook.
   *
   * @param {string} jobId  Media job id.
   * @param {{ status: string, outputKey?: string, error?: string }} jobResult
   */
  async function syncJobResult(jobId, { status, outputKey, error: errorMessage } = {}) {
    if (!db || !jobId) return;
    const record = await db.derivedFile.findFirst({ where: { jobId } });
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
   *
   * @param {string} id
   */
  async function remove(id) {
    if (!db || !id) return null;
    return db.derivedFile.delete({ where: { id } });
  }

  return { requestConversion, markCompleted, markFailed, markProcessing, listForItem, listForKey, syncJobResult, remove };
}
