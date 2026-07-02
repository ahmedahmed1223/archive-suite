import { withSentryConfig } from "@sentry/nextjs";

const archiveApiBaseUrl = process.env.ARCHIVE_API_BASE_URL?.replace(/\/$/, "");
const hasSentryUploadConfig =
  Boolean(process.env.SENTRY_AUTH_TOKEN) &&
  Boolean(process.env.SENTRY_ORG) &&
  Boolean(process.env.SENTRY_PROJECT);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  async rewrites() {
    if (!archiveApiBaseUrl) {
      return [];
    }

    return [
      {
        source: "/api/v1/:path*",
        destination: `${archiveApiBaseUrl}/:path*`
      }
    ];
  }
};

const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: hasSentryUploadConfig ? process.env.SENTRY_AUTH_TOKEN : undefined,
  silent: !process.env.CI,
  widenClientFileUpload: hasSentryUploadConfig
};

export default withSentryConfig(nextConfig, sentryOptions);
