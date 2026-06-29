/**
 * webhookService.ts
 * Fires outgoing webhooks with HMAC-SHA256 signatures.
 * Retries up to 3 times with exponential backoff.
 */
import { createHmac } from "node:crypto";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

interface Webhook {
  id: string;
  url: string;
  secret: string;
}

interface Logger {
  warn: (data: unknown, message: string) => void;
  error: (data: unknown, message: string) => void;
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function deliverOnce(url: string, payload: string, signature: string): Promise<boolean> {
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

async function deliverWithRetry(webhook: Webhook, event: string, data: unknown, logger: Logger | undefined): Promise<void> {
  const payload = JSON.stringify({ event, data, webhookId: webhook.id, timestamp: Date.now() });
  const signature = sign(webhook.secret, payload);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ok = await deliverOnce(webhook.url, payload, signature);
      if (ok) return;
      logger?.warn({ webhookId: webhook.id, attempt }, "webhook delivery non-2xx");
    } catch (err) {
      logger?.warn({ webhookId: webhook.id, attempt, err: (err as any).message }, "webhook delivery error");
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
 */
export function fireWebhooks(prisma: any, event: string, data: unknown, ownerId?: string, logger?: Logger): void {
  if (!prisma?.webhook) return; // graceful degradation

  setImmediate(async () => {
    try {
      const where: any = { active: true, events: { has: event } };
      if (ownerId) where.ownerId = ownerId;
      const hooks = await prisma.webhook.findMany({ where });
      await Promise.allSettled(
        hooks.map((hook: Webhook) => deliverWithRetry(hook, event, data, logger))
      );
    } catch (err) {
      logger?.error({ err }, "fireWebhooks failed to load hooks");
    }
  });
}
