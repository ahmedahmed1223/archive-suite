/**
 * webPushService.js — Web Push delivery (§20.2).
 *
 * Subscriptions live in Prisma (`push_subscriptions`); payloads are sent with
 * the `web-push` library using VAPID keys from the environment:
 *
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  (generate: npx web-push generate-vapid-keys)
 *   VAPID_SUBJECT                          (mailto: or https: contact, optional)
 *
 * Design mirrors notificationService.js:
 *   - sends are fire-and-forget (setImmediate) — never block the request
 *   - per-user, per-type preferences gate every send (pushOn* fields)
 *   - dead endpoints (404/410 from the push service) are pruned on send
 *   - similar alerts within a short window collapse into one (aggregation)
 *
 * `sendImpl` is injectable so verification scripts run fully offline.
 */

import { createLogger } from "../logger.js";

const log = createLogger("webPush");

const DEFAULT_PUSH_PREFS = { pushOnShare: true, pushOnUpload: true, pushOnMention: true, pushOnSystem: true };

// Aggregation: identical (userId, tag, title) alerts inside this window are dropped.
const AGGREGATION_WINDOW_MS = 30_000;
const recentSends = new Map(); // `${userId}:${tag}:${title}` → last send ms epoch

const aggregationPrune = setInterval(() => {
  const cutoff = Date.now() - AGGREGATION_WINDOW_MS;
  for (const [key, at] of recentSends) if (at < cutoff) recentSends.delete(key);
}, 60_000);
if (typeof aggregationPrune.unref === "function") aggregationPrune.unref();

let _webPush = null;
async function defaultSendImpl(subscription, payload) {
  if (!_webPush) {
    _webPush = (await import("web-push")).default;
    _webPush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
  return _webPush.sendNotification(subscription, payload);
}

/** True when VAPID keys are configured (the feature is otherwise dormant). */
export function isPushConfigured(env = process.env) {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(env = process.env) {
  return env.VAPID_PUBLIC_KEY || "";
}

/**
 * Persist (upsert) a browser push subscription for a user.
 * @param {object} prisma
 * @param {string} userId
 * @param {{endpoint:string, keys:{p256dh:string, auth:string}}} subscription
 */
export async function saveSubscription(prisma, userId, subscription) {
  const endpoint = String(subscription?.endpoint || "");
  const p256dh = String(subscription?.keys?.p256dh || "");
  const auth = String(subscription?.keys?.auth || "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    const err = new Error("اشتراك Push غير صالح.");
    err.statusCode = 400;
    throw err;
  }
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth },
    update: { userId, p256dh, auth },
  });
}

/** Remove a subscription by endpoint (browser unsubscribed). */
export async function removeSubscription(prisma, userId, endpoint) {
  // deleteMany keyed on both fields: a user can only remove their own rows.
  return prisma.pushSubscription.deleteMany({ where: { endpoint: String(endpoint || ""), userId } });
}

async function getPushPrefs(prisma, userId) {
  if (!prisma?.notificationPreference) return { ...DEFAULT_PUSH_PREFS };
  try {
    const row = await prisma.notificationPreference.findUnique({ where: { userId } });
    if (!row) return { ...DEFAULT_PUSH_PREFS };
    return {
      pushOnShare: row.pushOnShare ?? DEFAULT_PUSH_PREFS.pushOnShare,
      pushOnUpload: row.pushOnUpload ?? DEFAULT_PUSH_PREFS.pushOnUpload,
      pushOnMention: row.pushOnMention ?? DEFAULT_PUSH_PREFS.pushOnMention,
      pushOnSystem: row.pushOnSystem ?? DEFAULT_PUSH_PREFS.pushOnSystem,
    };
  } catch {
    return { ...DEFAULT_PUSH_PREFS };
  }
}

const TYPE_TO_PREF = {
  share: "pushOnShare",
  upload: "pushOnUpload",
  mention: "pushOnMention",
  system: "pushOnSystem",
};

/**
 * Send a Web Push notification to every device of a user (fire-and-forget).
 *
 * @param {object} opts
 * @param {object|null} opts.prisma
 * @param {string}      opts.userId
 * @param {"share"|"upload"|"mention"|"system"} opts.type - gates on the matching pushOn* pref
 * @param {string}      opts.title
 * @param {string}      [opts.body]
 * @param {string}      [opts.url]   - opened on notification click
 * @param {string}      [opts.tag]   - aggregation key; defaults to the type
 * @param {Function}    [opts.sendImpl] - (subscription, payloadJson) => Promise; injectable for tests
 * @param {Function}    [opts.onDone] - test hook fired after the async send settles
 */
export function sendPushToUser({ prisma, userId, type = "system", title, body, url, tag, sendImpl = defaultSendImpl, onDone }) {
  setImmediate(async () => {
    try {
      if (!prisma?.pushSubscription || !userId || !title) return;
      if (sendImpl === defaultSendImpl && !isPushConfigured()) return;

      const prefs = await getPushPrefs(prisma, userId);
      const prefKey = TYPE_TO_PREF[type] || "pushOnSystem";
      if (!prefs[prefKey]) return;

      // Aggregation — collapse identical alerts inside the window.
      const aggKey = `${userId}:${tag || type}:${title}`;
      const last = recentSends.get(aggKey) || 0;
      if (Date.now() - last < AGGREGATION_WINDOW_MS) return;
      recentSends.set(aggKey, Date.now());

      const subs = await prisma.pushSubscription.findMany({ where: { userId } });
      if (!subs.length) return;

      const payload = JSON.stringify({ title, body: body || "", url: url || "/", tag: tag || type, type });
      await Promise.all(subs.map(async (sub) => {
        try {
          await sendImpl(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (err) {
          const status = err?.statusCode || err?.status;
          if (status === 404 || status === 410) {
            // Endpoint is gone — prune it so we stop paying for dead sends.
            await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } }).catch(() => {});
            log.debug({ endpoint: sub.endpoint.slice(0, 48) }, "pruned dead push subscription");
          } else {
            log.warn({ err: err?.message, status }, "push send failed");
          }
        }
      }));

      log.debug({ userId, type, title }, "sendPushToUser: dispatched");
    } catch (err) {
      log.warn({ err: err?.message }, "sendPushToUser failed");
    } finally {
      if (typeof onDone === "function") onDone();
    }
  });
}
