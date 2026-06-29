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
 * The Prisma `RetentionRule` model (added in schema.prisma) persists rules on
 * disk; CRUD for that model lives in the API layer, not here.
 *
 * Scheduler integration:
 *   src/retention/retentionScheduler.js wires scanRetention() to the server's
 *   daily scheduler from src/index.js. This module stays pure for offline tests.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const VALID_ACTIONS = new Set(["archive", "delete"]);
const SCOPE_RE     = /^(?:all|type:[^:]+|tag:[^:]+)$/;

// ─── Rule parsing ──────────────────────────────────────────────────────────

/**
 * Parse a free-form rule description string into a structured rule object.
 *
 * Accepted format (pipe-separated, order-independent):
 *   "scope=all|lifetimeDays=365|action=delete"
 *   "scope=type:pdf|lifetimeDays=90|action=archive"
 *   "scope=tag:draft|lifetimeDays=30|action=delete"
 *
 * Returns a plain rule object with validated fields. Throws on bad input so
 * callers get an early, clear error instead of silent misbehaviour.
 *
 * @param {string} ruleString - pipe-separated key=value pairs
 * @returns {{ scope: string, lifetimeDays: number, action: string }}
 */
export function parseRetentionRule(ruleString) {
  if (typeof ruleString !== "string" || !ruleString.trim()) {
    throw new Error("parseRetentionRule: ruleString must be a non-empty string");
  }

  const pairs = ruleString.split("|").map((s) => s.trim()).filter(Boolean);
  const map   = {};
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
 *
 * The item's creation timestamp is read from (in preference order):
 *   item.createdAt  (Date | ISO string | epoch ms number)
 *   item.created_at (same)
 *
 * Items with no parseable timestamp are treated as NOT expired (safe default).
 *
 * @param {object} item
 * @param {{ lifetimeDays: number, scope: string }} rule
 * @param {number} [now=Date.now()] - epoch ms; injectable for deterministic tests
 * @returns {boolean}
 */
export function isExpired(item, rule, now = Date.now()) {
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
 * (not yet expired, but expiring soon), sorted by expiry date ascending.
 *
 * @param {object[]} items
 * @param {{ lifetimeDays: number, scope: string }} rule
 * @param {number} days - look-ahead window
 * @param {number} [now=Date.now()] - injectable for tests
 * @returns {Array<{ item: object, expiresAt: Date }>}
 */
export function findExpiringSoon(items, rule, days, now = Date.now()) {
  if (!Array.isArray(items) || !rule || days < 0) return [];

  const windowEnd = now + days * MS_PER_DAY;
  const results   = [];

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
  results.sort((a, b) => a.expiresAt - b.expiresAt);
  return results;
}

// ─── Retention sweep (cron skeleton) ──────────────────────────────────────

/**
 * Scan all items against all provided rules and produce an action plan.
 *
 * This function is pure — it does NOT write to the database. The caller
 * (the scheduler in src/index.js) is responsible for persisting the results:
 *   - "archive" → set archivedAt = new Date() on the ArchiveItem row
 *   - "delete"  → call secureOverwrite(filePath) then mark isDeleted/deletedAt
 *
 * @param {object[]} items  - items to evaluate (ArchiveItem-shaped)
 * @param {object[]} rules  - RetentionRule rows from the DB
 * @param {number}  [now]   - injectable epoch ms for tests
 * @returns {{ toArchive: object[], toDelete: object[] }}
 */
export function scanRetention(items, rules, now = Date.now()) {
  const toArchive = [];
  const toDelete  = [];

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

/**
 * @param {object} item
 * @param {string} scope
 * @returns {boolean}
 */
function itemMatchesScope(item, scope) {
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
 *
 * @param {Date|string|number|undefined|null} value
 * @returns {number|null}
 */
function resolveTimestamp(value) {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value) ? null : value.getTime();
  if (typeof value === "number" && isFinite(value)) return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return isNaN(ms) ? null : ms;
  }
  return null;
}
