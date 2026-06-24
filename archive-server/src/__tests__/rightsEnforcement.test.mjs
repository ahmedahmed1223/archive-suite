/**
 * Unit tests for rightsEnforcement.js
 * node:test style — 12 tests.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  checkRightsForExport,
  isExpiringSoon,
  buildRightsSummary,
} from "../rights/rightsEnforcement.js"

// ── Helpers ────────────────────────────────────────────────────────────────

function daysFromNow(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000)
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

// ── checkRightsForExport ───────────────────────────────────────────────────

await test("checkRightsForExport: expired rights → { allowed: false, reason: EXPIRED }", () => {
  const record = { expiresAt: daysAgo(1), geoRestrictions: [] }
  const result = checkRightsForExport({ record })
  assert.equal(result.allowed, false)
  assert.equal(result.reason, "EXPIRED")
})

await test("checkRightsForExport: future expiry → { allowed: true }", () => {
  const record = { expiresAt: daysFromNow(10), geoRestrictions: [] }
  const result = checkRightsForExport({ record })
  assert.equal(result.allowed, true)
  assert.equal(result.reason, undefined)
})

await test("checkRightsForExport: active embargo → { allowed: false, reason: EMBARGO }", () => {
  const record = {
    embargoStart: daysAgo(5),
    embargoEnd: daysFromNow(5),
    geoRestrictions: [],
  }
  const result = checkRightsForExport({ record })
  assert.equal(result.allowed, false)
  assert.equal(result.reason, "EMBARGO")
})

await test("checkRightsForExport: embargo ended → { allowed: true }", () => {
  const record = {
    embargoStart: daysAgo(10),
    embargoEnd: daysAgo(2),
    geoRestrictions: [],
  }
  const result = checkRightsForExport({ record })
  assert.equal(result.allowed, true)
})

await test("checkRightsForExport: geo restriction match → { allowed: false, reason: GEO_RESTRICTED }", () => {
  const record = {
    expiresAt: daysFromNow(90),
    geoRestrictions: ["CN", "RU"],
  }
  const result = checkRightsForExport({ record, requestingCountry: "CN" })
  assert.equal(result.allowed, false)
  assert.equal(result.reason, "GEO_RESTRICTED")
})

await test("checkRightsForExport: geo restriction no match → { allowed: true }", () => {
  const record = {
    expiresAt: daysFromNow(90),
    geoRestrictions: ["CN", "RU"],
  }
  const result = checkRightsForExport({ record, requestingCountry: "US" })
  assert.equal(result.allowed, true)
})

await test("checkRightsForExport: null record → { allowed: true }", () => {
  const result = checkRightsForExport({ record: null })
  assert.equal(result.allowed, true)
})

await test("checkRightsForExport: expiry check uses injected now", () => {
  const expiresAt = new Date("2024-01-15T00:00:00Z")
  const record = { expiresAt, geoRestrictions: [] }
  // Before expiry
  const before = checkRightsForExport({ record, now: new Date("2024-01-14T23:59:59Z") })
  assert.equal(before.allowed, true)
  // After expiry
  const after = checkRightsForExport({ record, now: new Date("2024-01-15T00:00:01Z") })
  assert.equal(after.allowed, false)
  assert.equal(after.reason, "EXPIRED")
})

// ── isExpiringSoon ─────────────────────────────────────────────────────────

await test("isExpiringSoon: within 30 days → true", () => {
  const record = { expiresAt: daysFromNow(15) }
  assert.equal(isExpiringSoon({ record }), true)
})

await test("isExpiringSoon: outside 30 days → false", () => {
  const record = { expiresAt: daysFromNow(45) }
  assert.equal(isExpiringSoon({ record }), false)
})

await test("isExpiringSoon: already expired → false (not 'soon')", () => {
  const record = { expiresAt: daysAgo(1) }
  assert.equal(isExpiringSoon({ record }), false)
})

// ── buildRightsSummary ─────────────────────────────────────────────────────

await test("buildRightsSummary: expired → status 'expired'", () => {
  const record = { expiresAt: daysAgo(3), embargoStart: null, embargoEnd: null }
  const summary = buildRightsSummary({ record })
  assert.equal(summary.status, "expired")
  assert.equal(summary.badge, "Expired")
})

await test("buildRightsSummary: expiring within 30 days → status 'expiring_soon'", () => {
  const record = { expiresAt: daysFromNow(7), embargoStart: null, embargoEnd: null }
  const summary = buildRightsSummary({ record })
  assert.equal(summary.status, "expiring_soon")
  assert.ok(typeof summary.daysUntilExpiry === "number")
  assert.ok(summary.daysUntilExpiry > 0 && summary.daysUntilExpiry <= 8)
})
