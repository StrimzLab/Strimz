FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/scheduler/ ./apps/scheduler/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm --filter @strimz/scheduler build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /repo/apps/scheduler/dist ./dist
COPY --from=build /repo/apps/scheduler/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 4200
USER node
CMD ["node", "dist/main.js"]
