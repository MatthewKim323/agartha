# Container image for the mc-bot + MCP server (optional prod path).
# Build from the repo root: docker build -f infra/deploy/bot.Dockerfile .

FROM oven/bun:1 AS base
WORKDIR /app

# install deps (workspace-aware)
FROM base AS deps
COPY package.json bun.lock* ./
COPY packages/shared/package.json packages/shared/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY apps/mc-bot/package.json apps/mc-bot/
RUN bun install --frozen-lockfile || bun install

# runtime — Bun runs TypeScript directly, no build step needed
FROM deps AS runtime
ENV NODE_ENV=production
COPY . .
EXPOSE 3001
CMD ["bun", "apps/mc-bot/src/index.ts"]
