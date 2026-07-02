FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY archive-app/package.json ./archive-app/package.json
COPY archive-core/package.json ./archive-core/package.json
COPY archive-next/package.json ./archive-next/package.json
COPY archive-server/package.json ./archive-server/package.json

RUN pnpm install --frozen-lockfile --filter @archive/next...

FROM deps AS builder

ARG ARCHIVE_API_BASE_URL=http://laravel:8000/api/v1
ARG NEXT_PUBLIC_REVERB_APP_KEY=
ARG NEXT_PUBLIC_REVERB_HOST=localhost
ARG NEXT_PUBLIC_REVERB_PORT=8080
ARG NEXT_PUBLIC_REVERB_SCHEME=http
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
ARG NEXT_PUBLIC_SENTRY_RELEASE=
ARG NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0
ARG SENTRY_DSN=
ARG SENTRY_ENVIRONMENT=production
ARG SENTRY_RELEASE=
ARG SENTRY_TRACES_SAMPLE_RATE=0

ENV ARCHIVE_API_BASE_URL=${ARCHIVE_API_BASE_URL}
ENV NEXT_PUBLIC_REVERB_APP_KEY=${NEXT_PUBLIC_REVERB_APP_KEY}
ENV NEXT_PUBLIC_REVERB_HOST=${NEXT_PUBLIC_REVERB_HOST}
ENV NEXT_PUBLIC_REVERB_PORT=${NEXT_PUBLIC_REVERB_PORT}
ENV NEXT_PUBLIC_REVERB_SCHEME=${NEXT_PUBLIC_REVERB_SCHEME}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}
ENV NEXT_PUBLIC_SENTRY_RELEASE=${NEXT_PUBLIC_SENTRY_RELEASE}
ENV NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=${NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV SENTRY_ENVIRONMENT=${SENTRY_ENVIRONMENT}
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
ENV SENTRY_TRACES_SAMPLE_RATE=${SENTRY_TRACES_SAMPLE_RATE}

COPY docs ./docs
COPY archive-next ./archive-next

RUN pnpm --filter @archive/next run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/archive-next/.next/standalone ./
COPY --from=builder /app/archive-next/.next/static ./archive-next/.next/static
COPY --from=builder /app/archive-next/public ./archive-next/public
COPY --from=builder /app/archive-next/package.json ./archive-next/package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", "archive-next/server.js"]
