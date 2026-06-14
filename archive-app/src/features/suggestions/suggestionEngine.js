/**
 * Smart usage-improvement suggestions engine (§1518).
 *
 * Given a snapshot of app state (videoItems, virtualCollections, contentTypes)
 * this module gently surfaces actionable nudges when it detects suboptimal
 * usage patterns — many items without tags, smart collections never adopted,
 * uncategorized items, likely duplicates, and items that were never opened.
 *
 * Everything here is pure and storage-agnostic: detectors are small functions
 * that take a normalized snapshot and return a suggestion object or null.
 * `buildSuggestions` runs them, drops dismissed ones, and sorts by priority.
 */

// Severity drives both visual tone and sort priority. Higher weight = surfaced
// first. Tunable thresholds live as named constants — no magic numbers inline.
const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 };

const UNTAGGED_MIN = 5; // below this it is not worth nudging
const UNTAGGED_HIGH = 15;
const UNCATEGORIZED_MIN = 5;
const UNCATEGORIZED_HIGH = 15;
const DUPLICATE_MIN_GROUPS = 1;
const STALE_DAYS = 90;
const STALE_MIN = 5;
const NEVER_VIEWED_MIN = 8;
const SMART_COLLECTIONS_MIN_ITEMS = 12; // only suggest once there is enough to organize

const DAY_MS = 24 * 60 * 60 * 1000;

function activeItems(videoItems = []) {
  return (videoItems || []).filter((item) => item && !item.isDeleted);
}

function normalizeTitle(title) {
  return String(title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isSmartCollection(collection = {}) {
  return collection?.filterRules?.kind === "rules";
}

function severityForCount(count, highThreshold) {
  return count >= highThreshold ? "high" : "medium";
}

/**
 * @param {object} snapshot { items, virtualCollections, contentTypes }
 * @returns {object|null} suggestion
 */
export function untaggedItems({ items = [] } = {}) {
  const offenders = items.filter((item) => !(item.tags || []).length);
  if (offenders.length < UNTAGGED_MIN) return null;
  return {
    id: "untagged-items",
    severity: severityForCount(offenders.length, UNTAGGED_HIGH),
    title: "وسِم المواد غير الموسومة",
    description: `${offenders.length} مادة بلا أي وسم، ما يُضعف البحث والاقتراحات المرتبطة. أضف وسوماً لأهمها.`,
    actionLabel: "فتح الأرشيف",
    actionPage: "archive",
    count: offenders.length
  };
}

export function noSmartCollections({ items = [], virtualCollections = [] } = {}) {
  if (items.length < SMART_COLLECTIONS_MIN_ITEMS) return null;
  if ((virtualCollections || []).some(isSmartCollection)) return null;
  return {
    id: "no-smart-collections",
    severity: "low",
    title: "جرّب المجموعات الذكية",
    description: "أرشيفك كبير بما يكفي للاستفادة من المجموعات الذكية التي تُحدّث عضويتها تلقائياً حسب الوسوم والنوع.",
    actionLabel: "فتح المجموعات",
    actionPage: "collections",
    count: items.length
  };
}

export function uncategorizedItems({ items = [] } = {}) {
  const offenders = items.filter((item) => !item.type);
  if (offenders.length < UNCATEGORIZED_MIN) return null;
  return {
    id: "uncategorized-items",
    severity: severityForCount(offenders.length, UNCATEGORIZED_HIGH),
    title: "صنّف المواد بلا نوع",
    description: `${offenders.length} مادة لم تُسنَد إلى نوع محتوى، وهذا يُصعّب التصفية والتقارير. حدّد نوعاً لكل منها.`,
    actionLabel: "فتح الأرشيف",
    actionPage: "archive",
    count: offenders.length
  };
}

export function duplicateTitleItems({ items = [] } = {}) {
  const byTitle = new Map();
  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key) continue;
    byTitle.set(key, (byTitle.get(key) || 0) + 1);
  }
  let duplicateGroups = 0;
  let duplicateCount = 0;
  for (const occurrences of byTitle.values()) {
    if (occurrences > 1) {
      duplicateGroups += 1;
      duplicateCount += occurrences;
    }
  }
  if (duplicateGroups < DUPLICATE_MIN_GROUPS) return null;
  return {
    id: "duplicate-titles",
    severity: duplicateGroups >= 3 ? "high" : "medium",
    title: "راجع المواد المكررة محتملاً",
    description: `${duplicateCount} مادة تتشارك العنوان نفسه ضمن ${duplicateGroups} مجموعة، وقد تكون نسخاً مكررة. افحصها قبل أن تتراكم.`,
    actionLabel: "كشف المكررات",
    actionPage: "duplicates",
    count: duplicateCount
  };
}

export function staleItems({ items = [], now = Date.now() } = {}) {
  const threshold = now - STALE_DAYS * DAY_MS;
  const offenders = items.filter((item) => {
    const stamp = item.lastViewedAt || item.updatedAt || item.createdAt;
    if (!stamp) return false;
    const time = new Date(stamp).getTime();
    return Number.isFinite(time) && time < threshold;
  });
  if (offenders.length < STALE_MIN) return null;
  return {
    id: "stale-items",
    severity: "low",
    title: "أحيِ المواد المهملة",
    description: `${offenders.length} مادة لم يُطّلع عليها منذ أكثر من ${STALE_DAYS} يوماً. راجعها أو امنحها وسوماً لإعادة اكتشافها.`,
    actionLabel: "فتح الأرشيف",
    actionPage: "archive",
    count: offenders.length
  };
}

export function neverViewedItems({ items = [] } = {}) {
  const offenders = items.filter((item) => !item.lastViewedAt);
  if (offenders.length < NEVER_VIEWED_MIN) return null;
  return {
    id: "never-viewed-items",
    severity: "low",
    title: "افتح المواد التي لم تُشاهَد قط",
    description: `${offenders.length} مادة أُضيفت ولم تُفتَح بعد. خصّص وقتاً لمراجعتها للتأكد من اكتمال بياناتها.`,
    actionLabel: "فتح الأرشيف",
    actionPage: "archive",
    count: offenders.length
  };
}

// Ordered list of detectors. Each receives the same normalized snapshot.
export const SUGGESTION_DETECTORS = [
  untaggedItems,
  uncategorizedItems,
  duplicateTitleItems,
  noSmartCollections,
  neverViewedItems,
  staleItems
];

function severityRank(suggestion) {
  return SEVERITY_WEIGHT[suggestion.severity] || 0;
}

/**
 * Build the prioritized, de-dismissed suggestion list.
 *
 * @param {object} state    { videoItems, virtualCollections, contentTypes }
 * @param {object} options  { dismissed?: string[], now?: number, limit?: number }
 * @returns {object[]} suggestions sorted by severity then count
 */
export function buildSuggestions(state = {}, { dismissed = [], now = Date.now(), limit = 4 } = {}) {
  const snapshot = {
    items: activeItems(state.videoItems),
    virtualCollections: state.virtualCollections || [],
    contentTypes: state.contentTypes || [],
    now
  };
  const dismissedSet = dismissed instanceof Set ? dismissed : new Set(dismissed || []);

  const suggestions = [];
  for (const detect of SUGGESTION_DETECTORS) {
    const suggestion = detect(snapshot);
    if (suggestion && !dismissedSet.has(suggestion.id)) suggestions.push(suggestion);
  }

  suggestions.sort((a, b) => severityRank(b) - severityRank(a) || (b.count || 0) - (a.count || 0));
  return suggestions.slice(0, Math.max(1, limit));
}
