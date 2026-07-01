FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY archive-app/package.json ./archive-app/package.json
COPY archive-core/package.json ./archive-core/package.json
COPY archive-next/package.json ./archive-next/package.json
COPY archive-server/package.json ./archive-server/package.json

RUN pnpm install --frozen-lockfile --filter @archive/next...

FROM deps AS builder

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
COPY --from=builder /app/archive-next/package.json ./archive-next/package.json

EXPOSE 3000

CMD ["node", "archive-next/server.js"]
