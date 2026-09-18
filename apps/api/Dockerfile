# Multi-stage build: install and build the whole workspace, ship only the API's
# runtime output plus its production node_modules.
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
COPY packages/database/package.json packages/database/
COPY packages/storage/package.json packages/storage/
COPY packages/realtime/package.json packages/realtime/
COPY packages/functions/package.json packages/functions/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/config packages/config
COPY packages/database packages/database
COPY packages/storage packages/storage
COPY packages/realtime packages/realtime
COPY packages/functions packages/functions
COPY apps/api apps/api
RUN pnpm --filter @stratum/shared --filter @stratum/config --filter @stratum/database \
      --filter @stratum/storage --filter @stratum/realtime --filter @stratum/functions build
RUN pnpm --filter @stratum/api build

FROM node:20-alpine AS runtime
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo ./
EXPOSE 8788
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://localhost:8788/health || exit 1
CMD ["node", "apps/api/dist/server.js"]
