// V1-761: feature flags for gradual rollout.
//
// Laravel's config/archive.php already carries all-or-nothing env flags that
// scope-lock experimental route groups (V1-001). Those cannot express "ship to
// 10% first", which is what a staged rollout needs, so this module adds
// deterministic percentage bucketing on top of the same on/off idea.
//
// Two properties carry the whole design:
//   * Determinism — a user's answer must never change between page loads, so
//     bucketing is a pure hash, never a random draw or a stored coin flip.
//   * Monotonicity — widening a rollout may only ever ADD users. Anyone who
//     had the feature at 10% still has it at 50%, because the bucket is fixed
//     and only the threshold moves.

export interface FeatureFlag {
  key: string;
  /** Kill switch. False means off for everyone, overrides and rollout included. */
  enabled: boolean;
  /** Share of users admitted, 0..100. Clamped if out of range. */
  rolloutPercentage: number;
  /** Always on for these users (unless denied or the flag is disabled). */
  allowUserIds?: string[];
  /** Always off for these users. Wins over allowUserIds. */
  denyUserIds?: string[];
  /** When present, the flag only exists in these environments. */
  environments?: string[];
}

export interface FlagContext {
  userId?: string;
  environment?: string;
}

const BUCKETS = 100;

/**
 * FNV-1a over `${flagKey}:${userId}`.
 *
 * The flag key is part of the hash on purpose: without it every flag would
 * order users identically, so the same unlucky cohort would be the first into
 * every rollout and a 10% test of five features would hit one group five times.
 */
export function bucketFor(flagKey: string, userId: string): number {
  const input = `${flagKey}:${userId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // FNV prime (16777619), via shifts to stay inside 32-bit integer math.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash % BUCKETS;
}

/** Resolves a flag for one user. Unknown or disabled flags are always off. */
export function evaluateFlag(flag: FeatureFlag | undefined | null, context: FlagContext = {}): boolean {
  if (!flag || flag.enabled !== true) return false;

  if (flag.environments?.length && !flag.environments.includes(context.environment ?? "")) return false;

  const { userId } = context;
  if (userId) {
    // Deny before allow: when a user is on both lists the answer is ambiguous,
    // and the safe reading of an opt-out is that it holds.
    if (flag.denyUserIds?.includes(userId)) return false;
    if (flag.allowUserIds?.includes(userId)) return true;
  }

  const rollout = Math.max(0, Math.min(BUCKETS, Number(flag.rolloutPercentage) || 0));
  if (rollout >= BUCKETS) return true;
  if (rollout <= 0) return false;

  // A partial rollout needs a stable identity to bucket. Anonymous callers have
  // none, so admitting them would flip the feature on and off between requests.
  if (!userId) return false;

  return bucketFor(flag.key, userId) < rollout;
}
