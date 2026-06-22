/**
 * Sentry error tracking — optional, no-op when SENTRY_DSN is not set.
 *
 * Call initSentry() once at server startup (in src/index.js) before any
 * other application code runs. All exports are safe no-ops when Sentry
 * is disabled, so callers never need to guard against a missing DSN.
 */

/** @type {import("@sentry/node") | null} */
let sentry = null;

/**
 * Initialise Sentry from the SENTRY_DSN env var.
 * Must be called before importing any other modules that should be instrumented.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initSentry() {
  if (sentry) return; // already initialised
  const { config } = await import("../config/env.js");
  if (!config.sentryDsn) return; // disabled — DSN not configured

  try {
    const mod = await import("@sentry/node");
    mod.init({
      dsn: config.sentryDsn,
      environment: config.nodeEnv,
      tracesSampleRate: 0.1,
      // Suppress noisy connection-reset errors that are harmless in practice.
      ignoreErrors: ["ECONNRESET", "ERR_STREAM_DESTROYED"],
    });
    sentry = mod;
    // Use console.log directly here since Pino logger imports happen after initSentry.
    console.log("[sentry] Initialized (environment=%s)", config.nodeEnv);
  } catch (err) {
    // Fail open — missing package or bad DSN must not crash the server.
    console.warn("[sentry] Failed to initialize:", err.message);
  }
}

/**
 * Capture an exception, optionally attaching extra key/value context.
 *
 * @param {unknown} err
 * @param {Record<string, unknown>} [context]
 */
export function captureException(err, context = {}) {
  if (!sentry) return;
  sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }
    sentry.captureException(err);
  });
}

/**
 * Capture a freeform message.
 *
 * @param {string} message
 * @param {"fatal"|"error"|"warning"|"info"|"debug"} [level]
 */
export function captureMessage(message, level = "info") {
  if (!sentry) return;
  sentry.captureMessage(message, level);
}

/**
 * Associate the current Sentry scope with a user identity.
 * Pass null to clear (e.g. after logout).
 *
 * @param {{ uid?: string; id?: string; username?: string } | null} user
 */
export function setSentryUser(user) {
  if (!sentry) return;
  sentry.setUser(user ? { id: user.uid ?? user.id, username: user.username } : null);
}
