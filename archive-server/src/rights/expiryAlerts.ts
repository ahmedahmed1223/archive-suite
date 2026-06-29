/**
 * expiryAlerts.ts — Rights expiry alert service.
 *
 * Scans for rights records expiring within N days and emits audit log entries.
 * Designed to be called by a scheduler (e.g. cron-style setInterval).
 * All dependencies are injected for testability.
 */

interface RightsRecord {
  id: string;
  itemId: string;
  rightsHolder: string;
  licenseType: string;
  expiresAt: Date | string;
}

interface AuditLogEntry {
  category: string;
  itemId: string;
  rightsRecordId: string;
  rightsHolder: string;
  licenseType: string;
  expiresAt: Date | string;
  daysUntilExpiry: number;
  alertedAt: Date;
}

interface Logger {
  info: (metadata: any, message: string) => void;
  warn: (metadata: any, message: string) => void;
  error: (metadata: any, message: string) => void;
}

interface ExpiryAlertService {
  scanAndAlert: () => Promise<{ alerted: RightsRecord[] }>;
}

/**
 * Create an expiry alert service.
 *
 * @param {object} params
 * @param {object}   params.prisma               - Prisma client (required)
 * @param {object}   params.logger               - Logger with .info/.warn/.error
 * @param {Function} params.auditLog             - (entry: object) => void | Promise<void>
 * @param {number}   [params.alertThresholdDays] - Days ahead to alert (default 30)
 * @returns {{ scanAndAlert: () => Promise<{ alerted: object[] }> }}
 */
export function createExpiryAlertService({
  prisma,
  logger,
  auditLog,
  alertThresholdDays = 30,
}: {
  prisma: any;
  logger: Logger;
  auditLog: (entry: AuditLogEntry) => void | Promise<void>;
  alertThresholdDays?: number;
}): ExpiryAlertService {
  if (!prisma) throw new Error("createExpiryAlertService: prisma is required");
  if (!logger) throw new Error("createExpiryAlertService: logger is required");
  if (typeof auditLog !== "function")
    throw new Error("createExpiryAlertService: auditLog must be a function");

  /**
   * Scan for rights records expiring within the threshold window and emit
   * an audit log entry for each one found.
   *
   * @returns {Promise<{ alerted: object[] }>}
   */
  async function scanAndAlert(): Promise<{ alerted: RightsRecord[] }> {
    const now = new Date();
    const cutoff = new Date(
      now.getTime() + alertThresholdDays * 24 * 60 * 60 * 1000
    );

    let records: RightsRecord[];
    try {
      records = await prisma.rightsRecord.findMany({
        where: {
          expiresAt: {
            gt: now,
            lte: cutoff,
          },
        },
        orderBy: { expiresAt: "asc" },
      });
    } catch (err: any) {
      logger.error(
        { err },
        "expiryAlerts: failed to query expiring rights records"
      );
      return { alerted: [] };
    }

    if (records.length === 0) {
      logger.info(
        { alertThresholdDays },
        "expiryAlerts: no records expiring soon"
      );
      return { alerted: [] };
    }

    const alerted: RightsRecord[] = [];

    for (const record of records) {
      const daysUntilExpiry = Math.ceil(
        (new Date(record.expiresAt).getTime() - now.getTime()) /
          (24 * 60 * 60 * 1000)
      );

      const entry: AuditLogEntry = {
        category: "RIGHTS_EXPIRY_ALERT",
        itemId: record.itemId,
        rightsRecordId: record.id,
        rightsHolder: record.rightsHolder,
        licenseType: record.licenseType,
        expiresAt: record.expiresAt,
        daysUntilExpiry,
        alertedAt: now,
      };

      try {
        await auditLog(entry);
        alerted.push(record);
        logger.info(
          { itemId: record.itemId, daysUntilExpiry },
          "expiryAlerts: rights expiry alert emitted"
        );
      } catch (err: any) {
        logger.error(
          { err, itemId: record.itemId },
          "expiryAlerts: failed to emit audit log entry"
        );
      }
    }

    return { alerted };
  }

  return { scanAndAlert };
}
