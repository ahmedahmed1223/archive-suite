let sentryErrorBoundary = null;

export async function initSentry(env) {
  if (!env?.VITE_SENTRY_DSN) return null;

  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: env.MODE === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (env.DEV) return null;
      return event;
    },
  });

  sentryErrorBoundary = Sentry.ErrorBoundary;
  globalThis.__ARCHIVE_SENTRY_ERROR_BOUNDARY__ = sentryErrorBoundary;
  return Sentry;
}

export function getSentryErrorBoundary() {
  return sentryErrorBoundary;
}
