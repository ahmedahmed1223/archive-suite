FROM node:26.5.0-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS deps

WORKDIR /app

RUN npm install --global corepack@0.31.0 \
  && corepack enable \
  && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY archive-next/package.json ./archive-next/package.json

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

FROM node:26.5.0-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/archive-next/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/archive-next/.next/static ./archive-next/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/archive-next/public ./archive-next/public
COPY --from=builder --chown=nextjs:nodejs /app/archive-next/package.json ./archive-next/package.json

USER nextjs

EXPOSE 3000

# Debian slim ships neither wget nor curl by default (unlike Alpine's busybox
# wget); use node itself so the healthcheck needs no extra apt-get install.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "archive-next/server.js"]
