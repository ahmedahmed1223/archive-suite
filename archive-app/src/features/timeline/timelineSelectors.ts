export const TIMELINE_GRANULARITIES = ["day", "week", "month", "year"] as const;
export const TIMELINE_LANE_GROUPS = ["all", "type", "year", "workflow"] as const;

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

type Granularity = typeof TIMELINE_GRANULARITIES[number];
type LaneGroup = typeof TIMELINE_LANE_GROUPS[number];

interface TimelineItem {
  id?: string;
  type?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  workflowStatus?: string;
  reviewStatus?: string;
  status?: string;
  [key: string]: unknown;
}

interface Bucket {
  key: string;
  label: string;
  count: number;
  items: TimelineItem[];
  byType: Record<string, number>;
}

export interface TimelineResult {
  buckets: Bucket[];
  maxCount: number;
  total: number;
  range: { from: string | null; to: string | null };
}

export interface TimelineLanesResult {
  lanes: Array<{
    key: string;
    label: string;
    total: number;
    buckets: Bucket[];
    maxCount: number;
    range: { from: string | null; to: string | null };
  }>;
  total: number;
  groupBy: LaneGroup;
  granularity: Granularity;
  maxLaneTotal: number;
}

const MONTH_INDEX = ARABIC_MONTHS.length;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function bucketFor(date: Date, granularity: string) {
  const year = date.getFullYear();
  switch (granularity) {
    case "year":
      return { key: `${year}`, label: `${year}` };
    case "week": {
      const { year: wYear, week } = isoWeek(date);
      return { key: `${wYear}-W${pad(week)}`, label: `أسبوع ${week} · ${wYear}` };
    }
    case "day": {
      const month = date.getMonth();
      const day = date.getDate();
      return { key: `${year}-${pad(month + 1)}-${pad(day)}`, label: `${day} ${ARABIC_MONTHS[month]} ${year}` };
    }
    case "month":
    default: {
      const month = date.getMonth();
      return { key: `${year}-${pad(month + 1)}`, label: `${ARABIC_MONTHS[month]} ${year}` };
    }
  }
}

export function buildTimeline(items: TimelineItem[] = [], options: { granularity?: string; dateField?: string; includeDeleted?: boolean } = {}): TimelineResult {
  const granularity = TIMELINE_GRANULARITIES.includes(options.granularity as Granularity) ? (options.granularity as Granularity) : "month";
  const dateField = options.dateField || "createdAt";
  const includeDeleted = options.includeDeleted === true;
  const list = Array.isArray(items) ? items : [];

  const map = new Map<string, Bucket>();
  let total = 0;
  let from: Date | null = null;
  let to: Date | null = null;

  for (const item of list) {
    if (!item || (!includeDeleted && item.isDeleted)) continue;
    const time = new Date(String(item[dateField]));
    if (Number.isNaN(time.getTime())) continue;
    const { key, label } = bucketFor(time, granularity);
    if (!map.has(key)) map.set(key, { key, label, count: 0, items: [], byType: {} });
    const bucket = map.get(key)!;
    bucket.count += 1;
    bucket.items.push(item);
    const type = item.type || "غير محدد";
    bucket.byType[type] = (bucket.byType[type] || 0) + 1;
    total += 1;
    if (!from || time < from) from = time;
    if (!to || time > to) to = time;
  }

  const buckets = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const maxCount = buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);

  return {
    buckets,
    maxCount,
    total,
    range: { from: from ? from.toISOString() : null, to: to ? to.toISOString() : null }
  };
}

function itemDate(item: TimelineItem, dateField: string): Date | null {
  const time = new Date(String(item?.[dateField]));
  return Number.isNaN(time.getTime()) ? null : time;
}

function workflowLabel(status = ""): string {
  if (status === "approved") return "معتمد";
  if (status === "needs_review" || status === "review") return "يحتاج مراجعة";
  if (status === "archived") return "مؤرشف";
  if (status === "done") return "منجز";
  if (status === "doing" || status === "in_progress") return "قيد العمل";
  if (status === "todo") return "للعمل";
  return status || "غير محدد";
}

function laneForItem(item: TimelineItem, groupBy: LaneGroup, dateField: string) {
  if (groupBy === "type") {
    const key = item?.type || "uncategorized";
    return { key, label: key === "uncategorized" ? "غير مصنف" : key };
  }
  if (groupBy === "year") {
    const date = itemDate(item, dateField);
    const year = date ? String(date.getFullYear()) : "undated";
    return { key: year, label: year === "undated" ? "بلا تاريخ" : year };
  }
  if (groupBy === "workflow") {
    const key = item?.workflowStatus || item?.reviewStatus || item?.status || "unknown";
    return { key, label: workflowLabel(key) };
  }
  return { key: "all", label: "كل الأرشيف" };
}

export function buildTimelineLanes(items: TimelineItem[] = [], options: { groupBy?: string; granularity?: string; dateField?: string; includeDeleted?: boolean } = {}): TimelineLanesResult {
  const groupBy = TIMELINE_LANE_GROUPS.includes(options.groupBy as LaneGroup) ? (options.groupBy as LaneGroup) : "all";
  const granularity = TIMELINE_GRANULARITIES.includes(options.granularity as Granularity) ? (options.granularity as Granularity) : "month";
  const dateField = options.dateField || "createdAt";
  const includeDeleted = options.includeDeleted === true;
  const groups = new Map<string, { key: string; label: string; items: TimelineItem[] }>();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || (!includeDeleted && item.isDeleted)) continue;
    if (!itemDate(item, dateField)) continue;
    const lane = laneForItem(item, groupBy, dateField);
    if (!groups.has(lane.key)) groups.set(lane.key, { ...lane, items: [] });
    groups.get(lane.key)!.items.push(item);
  }

  const lanes = [...groups.values()]
    .map((lane) => {
      const timeline = buildTimeline(lane.items, { granularity, dateField, includeDeleted: true });
      return {
        key: lane.key,
        label: lane.label,
        total: timeline.total,
        buckets: timeline.buckets,
        maxCount: timeline.maxCount,
        range: timeline.range
      };
    })
    .sort((a, b) => {
      if (groupBy === "year") return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
      if (a.key === "all") return -1;
      return b.total - a.total || String(a.label).localeCompare(String(b.label), "ar");
    });

  return {
    lanes,
    total: lanes.reduce((sum, lane) => sum + lane.total, 0),
    groupBy,
    granularity,
    maxLaneTotal: lanes.reduce((max, lane) => Math.max(max, lane.total), 0)
  };
}

export function timelineTypeTotals(timeline: TimelineResult) {
  const totals: Record<string, number> = {};
  for (const bucket of timeline?.buckets || []) {
    for (const [type, count] of Object.entries(bucket.byType)) {
      totals[type] = (totals[type] || 0) + count;
    }
  }
  return totals;
}
