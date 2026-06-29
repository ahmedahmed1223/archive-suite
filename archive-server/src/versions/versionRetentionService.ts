import { PrismaClient } from "../generated/prisma/client.js";

interface Logger {
  info: (data: unknown, message: string) => void;
  error: (data: unknown, message: string) => void;
  warn: (data: unknown, message: string) => void;
}

interface VersionRetentionResult {
  deleted: number;
}

const MAX_VERSIONS_PER_RECORD = 50;

/**
 * @param {import("../generated/prisma/client.js").PrismaClient} prisma
 * @param {{ info: Function, error: Function, warn: Function }} log
 */
export function createVersionRetentionService(prisma: PrismaClient, log: Logger) {
  async function pruneByCount(): Promise<number> {
    const over = await (prisma as any).$queryRaw`
      SELECT store, record_uid
      FROM record_versions
      GROUP BY store, record_uid
      HAVING COUNT(*) > ${MAX_VERSIONS_PER_RECORD}
    ` as Array<{ store: string; record_uid: string }>;

    let deleted = 0;
    for (const { store, record_uid } of over) {
      const rows = await (prisma as any).recordVersion.findMany({
        where: { store, recordUid: record_uid },
        orderBy: { createdAt: "desc" },
        skip: MAX_VERSIONS_PER_RECORD,
        select: { id: true },
      });
      if (rows.length) {
        const ids = rows.map((r: any) => r.id);
        const result = await (prisma as any).recordVersion.deleteMany({ where: { id: { in: ids } } });
        deleted += result.count;
      }
    }
    return deleted;
  }

  async function pruneByAge(retentionDays = 90): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await (prisma as any).recordVersion.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }

  async function run({ retentionDays = 90 } = {}): Promise<VersionRetentionResult> {
    try {
      const byCount = await pruneByCount();
      const byAge = await pruneByAge(retentionDays);
      const deleted = byCount + byAge;
      if (deleted > 0) {
        log.info({ byCount, byAge }, "Version retention: pruned old versions.");
      }
      return { deleted };
    } catch (err) {
      log.error({ err }, "Version retention run failed.");
      return { deleted: 0 };
    }
  }

  function scheduleHourly({ retentionDays = 90 } = {}): () => void {
    const id = setInterval(() => run({ retentionDays }), 60 * 60 * 1000);
    (id as any).unref?.();
    return function stop() { clearInterval(id); };
  }

  return { run, scheduleHourly };
}
