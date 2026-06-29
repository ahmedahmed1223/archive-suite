/**
 * rightsEnforcement.ts — Pure functions for rights/license enforcement.
 *
 * No Prisma, no network — callers pass in the rights record and context.
 * Designed for testability and injection into export/share routes.
 */

interface RightsRecord {
  expiresAt?: Date | string;
  embargoStart?: Date | string;
  embargoEnd?: Date | string;
  geoRestrictions?: string[];
}

interface RightsCheckResult {
  allowed: boolean;
  reason?: string;
}

interface RightsSummary {
  status: "ok" | "expired" | "embargo" | "expiring_soon";
  badge: string;
  daysUntilExpiry?: number;
}

/**
 * Check whether an item is exportable given its rights record.
 *
 * Rules (evaluated in order):
 *   1. If record.expiresAt is in the past → EXPIRED
 *   2. If now falls within record.embargoStart..embargoEnd → EMBARGO
 *   3. If requestingCountry is in record.geoRestrictions → GEO_RESTRICTED
 *   4. Otherwise → allowed
 *
 * @param {object} params
 * @param {object|null} params.record            - RightsRecord (may be null/undefined)
 * @param {string}      [params.requestingCountry] - ISO 3166-1 alpha-2 country code
 * @param {Date}        [params.now]               - override for current time (tests)
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkRightsForExport({
  record,
  requestingCountry,
  now = new Date(),
}: {
  record?: RightsRecord | null;
  requestingCountry?: string;
  now?: Date;
}): RightsCheckResult {
  if (!record) return { allowed: true };

  // 1. Expiry check
  if (record.expiresAt) {
    const expiresAt =
      record.expiresAt instanceof Date
        ? record.expiresAt
        : new Date(record.expiresAt);
    if (expiresAt <= now) {
      return { allowed: false, reason: "EXPIRED" };
    }
  }

  // 2. Embargo check — both dates must be present for a window to be active
  if (record.embargoStart && record.embargoEnd) {
    const start =
      record.embargoStart instanceof Date
        ? record.embargoStart
        : new Date(record.embargoStart);
    const end =
      record.embargoEnd instanceof Date
        ? record.embargoEnd
        : new Date(record.embargoEnd);
    if (now >= start && now <= end) {
      return { allowed: false, reason: "EMBARGO" };
    }
  } else if (record.embargoStart && !record.embargoEnd) {
    // Open-ended embargo: started but no end date means still active
    const start =
      record.embargoStart instanceof Date
        ? record.embargoStart
        : new Date(record.embargoStart);
    if (now >= start) {
      return { allowed: false, reason: "EMBARGO" };
    }
  }

  // 3. Geo restriction check
  if (
    requestingCountry &&
    Array.isArray(record.geoRestrictions) &&
    record.geoRestrictions.length > 0
  ) {
    if (record.geoRestrictions.includes(requestingCountry)) {
      return { allowed: false, reason: "GEO_RESTRICTED" };
    }
  }

  return { allowed: true };
}

/**
 * Check if a rights record expires within N days from now.
 *
 * @param {object} params
 * @param {object} params.record  - RightsRecord
 * @param {number} [params.days]  - threshold in days (default 30)
 * @param {Date}   [params.now]   - override for current time (tests)
 * @returns {boolean}
 */
export function isExpiringSoon({
  record,
  days = 30,
  now = new Date(),
}: {
  record?: RightsRecord;
  days?: number;
  now?: Date;
}): boolean {
  if (!record || !record.expiresAt) return false;
  const expiresAt =
    record.expiresAt instanceof Date
      ? record.expiresAt
      : new Date(record.expiresAt);
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  // Expiry is in the future (not yet expired) but within the threshold window
  return expiresAt > now && expiresAt <= cutoff;
}

/**
 * Build a human-readable enforcement summary for display.
 *
 * Status values:
 *   "expired"       — expiresAt is in the past
 *   "embargo"       — currently under embargo
 *   "expiring_soon" — expires within 30 days
 *   "ok"            — no active restrictions
 *
 * @param {object} params
 * @param {object|null} params.record
 * @param {Date}        [params.now]
 * @returns {{ status: string, badge: string, daysUntilExpiry?: number }}
 */
export function buildRightsSummary({
  record,
  now = new Date(),
}: {
  record?: RightsRecord | null;
  now?: Date;
}): RightsSummary {
  if (!record) {
    return { status: "ok", badge: "Unmanaged" };
  }

  const expiresAt = record.expiresAt
    ? record.expiresAt instanceof Date
      ? record.expiresAt
      : new Date(record.expiresAt)
    : null;

  // Expired
  if (expiresAt && expiresAt <= now) {
    return { status: "expired", badge: "Expired" };
  }

  // Embargo
  if (record.embargoStart) {
    const start =
      record.embargoStart instanceof Date
        ? record.embargoStart
        : new Date(record.embargoStart);
    const end = record.embargoEnd
      ? record.embargoEnd instanceof Date
        ? record.embargoEnd
        : new Date(record.embargoEnd)
      : null;

    const isUnderEmbargo = now >= start && (end === null || now <= end);
    if (isUnderEmbargo) {
      return { status: "embargo", badge: "Under Embargo" };
    }
  }

  // Expiring soon (within 30 days)
  if (expiresAt) {
    const msUntilExpiry = expiresAt.getTime() - now.getTime();
    const daysUntilExpiry = Math.ceil(
      msUntilExpiry / (24 * 60 * 60 * 1000)
    );
    if (daysUntilExpiry <= 30) {
      return {
        status: "expiring_soon",
        badge: `Expires in ${daysUntilExpiry}d`,
        daysUntilExpiry,
      };
    }
    return { status: "ok", badge: "Active", daysUntilExpiry };
  }

  return { status: "ok", badge: "Active" };
}
