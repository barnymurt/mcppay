FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY migrations/ migrations/
COPY vitest.config.ts tsconfig.base.json .env.example ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile && pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/server/dist/ ./dist/
COPY --from=builder /app/packages/types/dist/ ./packages/types/dist/
COPY --from=builder /app/packages/ledger/dist/ ./packages/ledger/dist/
COPY --from=builder /app/packages/rails/dist/ ./packages/rails/dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY migrations/ ./migrations/
COPY .env.example ./.env.example

ENV NODE_ENV=production
EXPOSE 3100 3101

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3101/health || exit 1

CMD ["node", "dist/index.js"]
