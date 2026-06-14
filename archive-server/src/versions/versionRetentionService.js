const MAX_VERSIONS_PER_RECORD = 50;

/**
 * @param {import("../generated/prisma/client.js").PrismaClient} prisma
 * @param {{ info: Function, error: Function, warn: Function }} log
 */
export function createVersionRetentionService(prisma, log) {
  async function pruneByCount() {
    const over = await prisma.$queryRaw`
      SELECT store, record_uid
      FROM record_versions
      GROUP BY store, record_uid
      HAVING COUNT(*) > ${MAX_VERSIONS_PER_RECORD}
    `;

    let deleted = 0;
    for (const { store, record_uid } of over) {
      const rows = await prisma.recordVersion.findMany({
        where: { store, recordUid: record_uid },
        orderBy: { createdAt: "desc" },
        skip: MAX_VERSIONS_PER_RECORD,
        select: { id: true },
      });
      if (rows.length) {
        const ids = rows.map((r) => r.id);
        const result = await prisma.recordVersion.deleteMany({ where: { id: { in: ids } } });
        deleted += result.count;
      }
    }
    return deleted;
  }

  async function pruneByAge(retentionDays = 90) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.recordVersion.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }

  async function run({ retentionDays = 90 } = {}) {
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

  function scheduleHourly({ retentionDays = 90 } = {}) {
    const id = setInterval(() => run({ retentionDays }), 60 * 60 * 1000);
    id.unref?.();
    return function stop() { clearInterval(id); };
  }

  return { run, scheduleHourly };
}
