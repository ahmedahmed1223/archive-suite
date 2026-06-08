/**
 * webhookService.js
 * Fires outgoing webhooks with HMAC-SHA256 signatures.
 * Retries up to 3 times with exponential backoff.
 */
import { createHmac } from "node:crypto";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

function sign(secret, payload) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function deliverOnce(url, payload, signature) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Timestamp": String(Date.now()),
        "User-Agent": "ArchiveSuite-Webhook/1.0",
      },
      body: payload,
      signal: controller.signal,
    });
    return res.ok;
  } finally {
    clearTimeout(timer);
  }
}

async function deliverWithRetry(webhook, event, data, logger) {
  const payload = JSON.stringify({ event, data, webhookId: webhook.id, timestamp: Date.now() });
  const signature = sign(webhook.secret, payload);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ok = await deliverOnce(webhook.url, payload, signature);
      if (ok) return;
      logger?.warn({ webhookId: webhook.id, attempt }, "webhook delivery non-2xx");
    } catch (err) {
      logger?.warn({ webhookId: webhook.id, attempt, err: err.message }, "webhook delivery error");
    }
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    }
  }
  logger?.error({ webhookId: webhook.id }, "webhook delivery failed after retries");
}

/**
 * Fire matching webhooks for an event. Non-blocking (fire-and-forget).
 *
 * Webhooks are scoped to the record owner: only hooks registered by the same
 * user who owns the record are fired. This prevents cross-user event leakage
 * in multi-tenant deployments. When `ownerId` is omitted (e.g. system events),
 * all active hooks matching the event are delivered.
 *
 * @param {object} prisma    - Prisma client
 * @param {string} event     - e.g. "record.created", "record.updated", "record.deleted"
 * @param {object} data      - event payload sent in the webhook body
 * @param {string} [ownerId] - record owner's user id; scopes delivery to their hooks only
 * @param {object} [logger]  - optional Pino logger
 */
export function fireWebhooks(prisma, event, data, ownerId, logger) {
  if (!prisma?.webhook) return; // graceful degradation

  setImmediate(async () => {
    try {
      const where = { active: true, events: { has: event } };
      if (ownerId) where.ownerId = ownerId;
      const hooks = await prisma.webhook.findMany({ where });
      await Promise.allSettled(
        hooks.map(hook => deliverWithRetry(hook, event, data, logger))
      );
    } catch (err) {
      logger?.error({ err }, "fireWebhooks failed to load hooks");
    }
  });
}
