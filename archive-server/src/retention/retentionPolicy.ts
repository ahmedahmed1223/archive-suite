/**
 * Retention policy — pure functions.
 *
 * Rule shape:
 *   {
 *     id:           string,
 *     name:         string,
 *     scope:        "all" | "type:<typeId>" | "tag:<tag>",
 *     lifetimeDays: number,   // positive integer
 *     action:       "archive" | "delete",
 *   }
 *
 * No I/O here — all functions are pure so they can be unit-tested offline.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const VALID_ACTIONS = new Set(["archive", "delete"]);
const SCOPE_RE     = /^(?:all|type:[^:]+|tag:[^:]+)$/;

interface RetentionRule {
  scope: string;
  lifetimeDays: number;
  action: string;
}

interface ArchiveItem {
  id: string;
  createdAt?: string | number | Date;
  created_at?: string | number | Date;
  archivedAt?: string | number | Date;
  isDeleted?: boolean;
  documentType?: string;
  mimeType?: string;
  store?: string;
  tags?: string[];
}

interface ExpiringItem {
  item: ArchiveItem;
  expiresAt: Date;
}

interface ScanResult {
  toArchive: ArchiveItem[];
  toDelete: ArchiveItem[];
}

// ─── Rule parsing ──────────────────────────────────────────────────────────

/**
 * Parse a free-form rule description string into a structured rule object.
 */
export function parseRetentionRule(ruleString: string): RetentionRule {
  if (typeof ruleString !== "string" || !ruleString.trim()) {
    throw new Error("parseRetentionRule: ruleString must be a non-empty string");
  }

  const pairs = ruleString.split("|").map((s) => s.trim()).filter(Boolean);
  const map: Record<string, string> = {};
  for (const pair of pairs) {
    const eq  = pair.indexOf("=");
    if (eq < 1) throw new Error(`parseRetentionRule: malformed pair "${pair}" (missing '=')`);
    const key = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1).trim();
    map[key]  = val;
  }

  const scope        = map.scope  || "all";
  const action       = map.action || "archive";
  const lifetimeDays = Number(map.lifetimeDays);

  if (!SCOPE_RE.test(scope)) {
    throw new Error(`parseRetentionRule: invalid scope "${scope}" — must be "all", "type:<id>", or "tag:<tag>"`);
  }
  if (!VALID_ACTIONS.has(action)) {
    throw new Error(`parseRetentionRule: invalid action "${action}" — must be "archive" or "delete"`);
  }
  if (!Number.isInteger(lifetimeDays) || lifetimeDays < 1) {
    throw new Error(`parseRetentionRule: lifetimeDays must be a positive integer, got "${map.lifetimeDays}"`);
  }

  return { scope, lifetimeDays, action };
}

// ─── Expiry helpers ────────────────────────────────────────────────────────

/**
 * Determine whether an item has exceeded its lifetime under the given rule.
 */
export function isExpired(item: ArchiveItem, rule: RetentionRule, now = Date.now()): boolean {
  if (!item || typeof item !== "object") return false;
  if (!rule || typeof rule.lifetimeDays !== "number") return false;

  if (!itemMatchesScope(item, rule.scope)) return false;

  const createdTs = resolveTimestamp(item.createdAt ?? item.created_at);
  if (createdTs === null) return false;

  const deadlineMs = createdTs + rule.lifetimeDays * MS_PER_DAY;
  return now >= deadlineMs;
}

/**
 * Return the subset of items that will expire within the next `days` days
 */
export function findExpiringSoon(items: ArchiveItem[], rule: RetentionRule, days: number, now = Date.now()): ExpiringItem[] {
  if (!Array.isArray(items) || !rule || days < 0) return [];

  const windowEnd = now + days * MS_PER_DAY;
  const results: ExpiringItem[]   = [];

  for (const item of items) {
    if (!item || !itemMatchesScope(item, rule.scope)) continue;

    const createdTs = resolveTimestamp(item.createdAt ?? item.created_at);
    if (createdTs === null) continue;

    const deadlineMs = createdTs + rule.lifetimeDays * MS_PER_DAY;

    // Not yet expired AND within the look-ahead window.
    if (deadlineMs > now && deadlineMs <= windowEnd) {
      results.push({ item, expiresAt: new Date(deadlineMs) });
    }
  }

  // Sort by soonest expiry first.
  results.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  return results;
}

// ─── Retention sweep (cron skeleton) ──────────────────────────────────────

/**
 * Scan all items against all provided rules and produce an action plan.
 */
export function scanRetention(items: ArchiveItem[], rules: RetentionRule[], now = Date.now()): ScanResult {
  const toArchive: ArchiveItem[] = [];
  const toDelete: ArchiveItem[]  = [];

  if (!Array.isArray(items) || !Array.isArray(rules)) {
    return { toArchive, toDelete };
  }

  for (const item of items) {
    if (!item) continue;
    // Skip items already processed by a previous sweep.
    if (item.archivedAt || item.isDeleted) continue;

    for (const rule of rules) {
      if (!rule || !rule.lifetimeDays || !rule.action) continue;
      if (!isExpired(item, rule, now)) continue;

      if (rule.action === "archive") {
        toArchive.push(item);
      } else if (rule.action === "delete") {
        toDelete.push(item);
      }
      break; // first matching rule wins
    }
  }

  return { toArchive, toDelete };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

function itemMatchesScope(item: ArchiveItem, scope: string): boolean {
  if (scope === "all") return true;

  if (scope.startsWith("type:")) {
    const typeId = scope.slice(5);
    return (
      item.documentType === typeId ||
      item.mimeType     === typeId ||
      item.store        === typeId
    );
  }

  if (scope.startsWith("tag:")) {
    const tag  = scope.slice(4);
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return tags.includes(tag);
  }

  return false;
}

/**
 * Coerce a timestamp value to epoch milliseconds.
 * Returns null if the value cannot be parsed.
 */
function resolveTimestamp(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "number" && isFinite(value)) return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return isNaN(ms) ? null : ms;
  }
  return null;
}
