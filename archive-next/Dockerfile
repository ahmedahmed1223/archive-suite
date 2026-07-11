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

ENV ARCHIVE_API_BASE_URL=${ARCHIVE_API_BASE_URL}
ENV NEXT_PUBLIC_REVERB_APP_KEY=${NEXT_PUBLIC_REVERB_APP_KEY}
ENV NEXT_PUBLIC_REVERB_HOST=${NEXT_PUBLIC_REVERB_HOST}
ENV NEXT_PUBLIC_REVERB_PORT=${NEXT_PUBLIC_REVERB_PORT}
ENV NEXT_PUBLIC_REVERB_SCHEME=${NEXT_PUBLIC_REVERB_SCHEME}

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
