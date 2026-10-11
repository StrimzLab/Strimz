# syntax=docker/dockerfile:1.7
#
# Strimz HTTP API — multi-stage build.
#
# Stage 1 builds with the full pnpm workspace context (so workspace:*
# deps resolve), then stage 2 ships only the compiled output + the
# pruned node_modules tree. Mirrors apps/scheduler and apps/agent.

FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm --filter "@strimz/api..." build
RUN pnpm --filter @strimz/api deploy --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
ENV NODE_ENV=production
EXPOSE 4000
USER node
CMD ["node", "dist/main.js"]
