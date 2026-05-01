FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tooling/ ./tooling/
COPY packages/ ./packages/
COPY apps/agent/ ./apps/agent/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm --filter @strimz/agent build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /repo/apps/agent/dist ./dist
COPY --from=build /repo/apps/agent/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 4300
USER node
CMD ["node", "dist/main.js"]
