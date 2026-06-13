const DAY_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value) {
  if (!value) return 0;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeId(value) {
  return value == null ? "" : String(value);
}

function getItemFreshnessTime(item) {
  return toTimestamp(item?.updatedAt || item?.createdAt || item?.lastViewedAt);
}

function getItemLastSeenTime(item) {
  return toTimestamp(item?.lastViewedAt || item?.updatedAt || item?.createdAt);
}

function getLogTime(log) {
  return toTimestamp(log?.timestamp || log?.createdAt || log?.updatedAt);
}

function getLogTargetIds(log = {}) {
  return [
    log.itemId,
    log.targetId,
    log.entityId,
    log.videoId,
    log.item?.id,
    log.target?.id,
    log.payload?.itemId,
    log.payload?.targetId,
    log.metadata?.itemId,
    log.metadata?.targetId
  ].map(normalizeId).filter(Boolean);
}

function createAuditIndex(auditLogs = [], nowTime = Date.now()) {
  const index = new Map();
  const weekAgo = nowTime - (7 * DAY_MS);

  for (const log of Array.isArray(auditLogs) ? auditLogs : []) {
    const logTime = getLogTime(log);
    for (const id of getLogTargetIds(log)) {
      const current = index.get(id) || { total: 0, weekly: 0, latestAt: 0 };
      current.total += 1;
      if (logTime >= weekAgo) current.weekly += 1;
      current.latestAt = Math.max(current.latestAt, logTime);
      index.set(id, current);
    }
  }

  return index;
}

function hashSeed(seed) {
  const text = String(seed || "discover");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicShuffle(items, seed = "discover") {
  const shuffled = [...items];
  let state = hashSeed(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function enrichItem(item, auditIndex, nowTime) {
  const audit = auditIndex.get(normalizeId(item?.id)) || { total: 0, weekly: 0, latestAt: 0 };
  const freshnessTime = getItemFreshnessTime(item);
  const lastSeenAt = getItemLastSeenTime(item);
  const ageDays = lastSeenAt ? Math.max(0, Math.floor((nowTime - lastSeenAt) / DAY_MS)) : null;

  return {
    ...item,
    discovery: {
      auditTotal: audit.total,
      weeklyActivity: audit.weekly,
      latestActivityAt: audit.latestAt,
      freshnessTime,
      lastSeenAt,
      ageDays
    }
  };
}

function sortByNumberDesc(selector) {
  return (first, second) => {
    const diff = (selector(second) || 0) - (selector(first) || 0);
    if (diff) return diff;
    return String(first.title || first.name || first.id || "").localeCompare(String(second.title || second.name || second.id || ""), "ar");
  };
}

function withReason(items, reason) {
  return items.map((item) => ({ ...item, discoveryReason: reason }));
}

export function buildDiscoverySections({
  videoItems = [],
  auditLogs = [],
  now = new Date(),
  limit = 8,
  seed = "discover"
} = {}) {
  const nowTime = toTimestamp(now) || Date.now();
  const safeLimit = Math.max(1, Number(limit) || 8);
  const auditIndex = createAuditIndex(auditLogs, nowTime);
  const activeItems = (Array.isArray(videoItems) ? videoItems : [])
    .filter((item) => item && !item.isDeleted)
    .map((item) => enrichItem(item, auditIndex, nowTime));

  const exploreItems = [...activeItems]
    .sort(sortByNumberDesc((item) => (
      getItemFreshnessTime(item) +
      (item.isFavorite ? DAY_MS * 4 : 0) +
      (item.discovery.weeklyActivity * DAY_MS)
    )))
    .slice(0, safeLimit);

  const trendingItems = [...activeItems]
    .sort(sortByNumberDesc((item) => (
      (item.discovery.latestActivityAt || item.discovery.lastSeenAt || item.discovery.freshnessTime) +
      (item.discovery.weeklyActivity * DAY_MS * 3)
    )))
    .slice(0, safeLimit);

  const activeWeeklyItems = [...activeItems]
    .sort(sortByNumberDesc((item) => (
      (item.discovery.weeklyActivity * 1000000) +
      (item.discovery.auditTotal * 1000) +
      item.discovery.latestActivityAt
    )))
    .slice(0, safeLimit);

  const forgottenCandidates = activeItems.filter((item) => (
    item.discovery.weeklyActivity === 0 &&
    (!item.discovery.lastSeenAt || item.discovery.lastSeenAt <= nowTime - (14 * DAY_MS))
  ));
  const forgottenItems = (forgottenCandidates.length ? forgottenCandidates : activeItems)
    .sort((first, second) => {
      const firstSeen = first.discovery.lastSeenAt || 0;
      const secondSeen = second.discovery.lastSeenAt || 0;
      if (firstSeen !== secondSeen) return firstSeen - secondSeen;
      return String(first.title || first.id || "").localeCompare(String(second.title || second.id || ""), "ar");
    })
    .slice(0, safeLimit);

  const randomItems = deterministicShuffle(activeItems, `${seed}:${activeItems.length}:${safeLimit}`)
    .slice(0, safeLimit);

  return [
    {
      id: "explore",
      label: "استكشف",
      description: "اختيارات حديثة ومفضلة تمنحك بداية سريعة داخل الأرشيف.",
      tone: "primary",
      items: withReason(exploreItems, "محتوى حديث أو مفضل")
    },
    {
      id: "trending",
      label: "رائج",
      description: "مواد عاد إليها الفريق مؤخراً أو ارتبطت بنشاط قريب.",
      tone: "secondary",
      items: withReason(trendingItems, "نشاط قريب")
    },
    {
      id: "random",
      label: "عشوائي",
      description: "عينة ثابتة اليوم لكسر نمط البحث المعتاد.",
      tone: "accent",
      items: withReason(randomItems, "اختيار مفاجئ")
    },
    {
      id: "active",
      label: "الأكثر نشاطاً",
      description: "الأكثر حضوراً في سجل النشاط خلال الأيام السبعة الماضية.",
      tone: "info",
      items: withReason(activeWeeklyItems, "نشاط أسبوعي")
    },
    {
      id: "forgotten",
      label: "المنسيّون",
      description: "مواد لم تظهر في النشاط القريب وتستحق مراجعة جديدة.",
      tone: "warning",
      items: withReason(forgottenItems, "بعيد عن المراجعة")
    }
  ];
}

export function getDiscoveryStats({ videoItems = [], sections = [] } = {}) {
  const activeCount = (Array.isArray(videoItems) ? videoItems : []).filter((item) => item && !item.isDeleted).length;
  const surfacedIds = new Set();
  for (const section of Array.isArray(sections) ? sections : []) {
    for (const item of section.items || []) {
      if (item?.id) surfacedIds.add(item.id);
    }
  }

  return {
    activeCount,
    sectionCount: Array.isArray(sections) ? sections.length : 0,
    surfacedCount: surfacedIds.size
  };
}

export const __testing = {
  deterministicShuffle,
  toTimestamp
};
