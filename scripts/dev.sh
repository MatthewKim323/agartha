#!/usr/bin/env bash
# Bring up the full local dev loop:
#   1. local Paper MC server (docker)
#   2. wait for it to accept connections
#   3. the bot + MCP server
#
# Hermes you start separately (see docs/HERMES_SETUP.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "no .env found — copy .env.example to .env and fill it in first." >&2
  exit 1
fi

echo "▸ starting local minecraft server…"
docker compose -f infra/docker-compose.yml up -d mc

echo "▸ waiting for MC on :25565…"
for _ in $(seq 1 60); do
  if nc -z localhost 25565 2>/dev/null; then break; fi
  sleep 2
done

echo "▸ starting itto bot + MCP server…"
bun run bot
