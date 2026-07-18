#!/bin/bash
#
# Launch wrapper for the voice agent.
#
# Exists for the same reason gbrain's does: launchd's KeepAlive will happily
# respawn a process that can never succeed, turning one bad config into an
# infinite crash loop. So preflight the things that are knowably wrong before
# handing control to node, and fail slowly and loudly rather than fast and
# silently.

set -uo pipefail

AGARTHA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$AGARTHA_DIR" || exit 1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [launch] $*"; }

# launchd's PATH omits homebrew, where node/bun/ffmpeg live on Apple Silicon.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
else
  log "FATAL: no .env at $AGARTHA_DIR/.env"
  sleep 30   # don't let KeepAlive spin
  exit 1
fi

missing=()
for var in GEMINI_API_KEY AGARTHA_DISCORD_TOKEN DISCORD_GUILD_ID DISCORD_VOICE_CHANNEL_ID; do
  [ -z "${!var:-}" ] && missing+=("$var")
done
if [ ${#missing[@]} -gt 0 ]; then
  log "FATAL: missing config: ${missing[*]}"
  sleep 30
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  log "FATAL: node not on PATH ($PATH)"
  sleep 30
  exit 1
fi

# The agent degrades gracefully when the bot or gbrain is down, so these are
# warnings rather than a refusal to start.
curl -sf -m 2 "http://127.0.0.1:${MCP_PORT:-3001}/health" >/dev/null 2>&1 \
  || log "WARN: mc-bot not reachable on :${MCP_PORT:-3001} — starting without hands"
curl -sf -m 2 "http://127.0.0.1:3131/health" >/dev/null 2>&1 \
  || log "WARN: gbrain not reachable on :3131 — starting without memory"

log "starting voice agent"
exec node --import tsx apps/voice-agent/src/index.ts
