import { describe, expect, it } from "vitest";

import { bucketFor, evaluateFlag, type FeatureFlag } from "./feature-flags";

// V1-761: gradual rollout. Laravel's config/archive.php already has all-or-
// nothing env flags for scope-locking; this adds the percentage rollout those
// cannot express. The properties that matter most are determinism (a user must
// not see a feature flicker between page loads) and monotonicity (raising a
// rollout must never take the feature away from someone who already had it).

const flag = (overrides: Partial<FeatureFlag> = {}): FeatureFlag => ({
  key: "new-search",
  enabled: true,
  rolloutPercentage: 100,
  ...overrides,
});

const users = Array.from({ length: 1000 }, (_, i) => `user-${i}`);

describe("bucketFor", () => {
  it("assigns a stable bucket in 0..99", () => {
    for (const userId of users.slice(0, 50)) {
      const bucket = bucketFor("new-search", userId);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
      expect(Number.isInteger(bucket)).toBe(true);
    }
  });

  it("is deterministic — the same flag and user always land in the same bucket", () => {
    expect(bucketFor("new-search", "user-42")).toBe(bucketFor("new-search", "user-42"));
  });

  it("decorrelates flags, so being in one rollout does not drag a user into another", () => {
    // If the flag key were left out of the hash, every flag would pick the same
    // unlucky users and 'a bit of everything' rollouts would hit one cohort.
    const a = users.map((id) => bucketFor("flag-a", id));
    const b = users.map((id) => bucketFor("flag-b", id));
    const identical = a.filter((bucket, i) => bucket === b[i]).length;
    expect(identical).toBeLessThan(users.length * 0.2);
  });

  it("spreads users roughly evenly across the range", () => {
    const inFirstHalf = users.filter((id) => bucketFor("new-search", id) < 50).length;
    expect(inFirstHalf).toBeGreaterThan(users.length * 0.4);
    expect(inFirstHalf).toBeLessThan(users.length * 0.6);
  });
});

describe("evaluateFlag", () => {
  it("is off when the flag is disabled, whatever the rollout says", () => {
    expect(evaluateFlag(flag({ enabled: false, rolloutPercentage: 100 }), { userId: "user-1" })).toBe(false);
  });

  it("is on for everyone at 100% and off for everyone at 0%", () => {
    expect(users.every((id) => evaluateFlag(flag({ rolloutPercentage: 100 }), { userId: id }))).toBe(true);
    expect(users.some((id) => evaluateFlag(flag({ rolloutPercentage: 0 }), { userId: id }))).toBe(false);
  });

  it("admits roughly the requested share of users at a partial rollout", () => {
    const admitted = users.filter((id) => evaluateFlag(flag({ rolloutPercentage: 25 }), { userId: id })).length;
    expect(admitted).toBeGreaterThan(users.length * 0.2);
    expect(admitted).toBeLessThan(users.length * 0.3);
  });

  it("never revokes the feature as the rollout widens", () => {
    // The whole point of a gradual rollout: going 10% → 50% → 100% may only
    // ever add users. A user losing a feature mid-rollout is a bug report.
    const admittedAt = (percentage: number) =>
      new Set(users.filter((id) => evaluateFlag(flag({ rolloutPercentage: percentage }), { userId: id })));

    const ten = admittedAt(10);
    const fifty = admittedAt(50);
    const hundred = admittedAt(100);

    for (const id of ten) expect(fifty.has(id)).toBe(true);
    for (const id of fifty) expect(hundred.has(id)).toBe(true);
  });

  it("is stable across repeated evaluation for one user", () => {
    const decisions = Array.from({ length: 20 }, () => evaluateFlag(flag({ rolloutPercentage: 37 }), { userId: "user-7" }));
    expect(new Set(decisions).size).toBe(1);
  });

  it("lets an explicit allow list beat a 0% rollout", () => {
    expect(evaluateFlag(flag({ rolloutPercentage: 0, allowUserIds: ["beta-tester"] }), { userId: "beta-tester" })).toBe(true);
  });

  it("lets an explicit deny list beat a 100% rollout", () => {
    expect(evaluateFlag(flag({ rolloutPercentage: 100, denyUserIds: ["opted-out"] }), { userId: "opted-out" })).toBe(false);
  });

  it("honours deny over allow when a user is on both lists", () => {
    // Ambiguity must resolve to the safer answer, not to list order.
    expect(evaluateFlag(flag({ allowUserIds: ["x"], denyUserIds: ["x"] }), { userId: "x" })).toBe(false);
  });

  it("keeps a disabled flag off even for an allow-listed user", () => {
    // `enabled: false` is the kill switch; it must not be routed around.
    expect(evaluateFlag(flag({ enabled: false, allowUserIds: ["beta-tester"] }), { userId: "beta-tester" })).toBe(false);
  });

  it("fails closed for an anonymous user on a partial rollout", () => {
    // With no stable identity there is no stable bucket, so admitting them
    // would make the feature flicker between requests.
    expect(evaluateFlag(flag({ rolloutPercentage: 50 }), {})).toBe(false);
  });

  it("still serves an anonymous user at a full rollout", () => {
    expect(evaluateFlag(flag({ rolloutPercentage: 100 }), {})).toBe(true);
  });

  it("treats an out-of-range rollout as its nearest legal value", () => {
    expect(evaluateFlag(flag({ rolloutPercentage: 150 }), { userId: "user-1" })).toBe(true);
    expect(evaluateFlag(flag({ rolloutPercentage: -20 }), { userId: "user-1" })).toBe(false);
  });

  it("fails closed for an unknown flag", () => {
    expect(evaluateFlag(undefined, { userId: "user-1" })).toBe(false);
  });

  it("restricts a flag to its declared environments", () => {
    const staged = flag({ environments: ["local", "staging"] });
    expect(evaluateFlag(staged, { userId: "user-1", environment: "staging" })).toBe(true);
    expect(evaluateFlag(staged, { userId: "user-1", environment: "production" })).toBe(false);
  });

  it("ignores environment gating when a flag declares no environments", () => {
    expect(evaluateFlag(flag(), { userId: "user-1", environment: "production" })).toBe(true);
  });
});
