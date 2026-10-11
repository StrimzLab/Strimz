FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/scheduler/ ./apps/scheduler/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm --filter "@strimz/scheduler..." build
RUN pnpm --filter @strimz/scheduler deploy --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/scheduler/dist ./dist
ENV NODE_ENV=production
EXPOSE 4200
USER node
CMD ["node", "dist/main.js"]
