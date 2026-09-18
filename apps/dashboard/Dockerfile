FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/dashboard/package.json apps/dashboard/
RUN pnpm install --frozen-lockfile --filter @stratum/dashboard...

FROM deps AS build
COPY apps/dashboard apps/dashboard
RUN pnpm --filter @stratum/dashboard build

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/apps/dashboard/.next apps/dashboard/.next
COPY --from=build /repo/apps/dashboard/public apps/dashboard/public
COPY --from=build /repo/apps/dashboard/package.json apps/dashboard/package.json
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/dashboard/node_modules apps/dashboard/node_modules
WORKDIR /repo/apps/dashboard
EXPOSE 8787
CMD ["npx", "next", "start", "-p", "8787"]
