#!/bin/bash
#
# One-command demo: preflight everything, then run the bot and the voice agent
# side by side with prefixed logs.
#
#   ./scripts/demo.sh
#
# Ctrl-C stops both.

set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" || exit 1

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[2m'; OFF=$'\033[0m'
ok()   { echo "  ${GRN}ok${OFF}   $*"; }
warn() { echo "  ${YEL}warn${OFF} $*"; }
die()  { echo "  ${RED}FAIL${OFF} $*"; exit 1; }

[ -f .env ] || die "no .env"
set -a; . ./.env; set +a

echo "preflight"

# 1. Minecraft. A TCP connect check is NOT enough: Aternos's info proxy accepts
#    connections and answers status long after the server has stopped, so nc
#    reports healthy while every login times out at 60s. Do a real status ping.
#    It also polls, because Aternos takes a minute or two to finish booting
#    after the panel flips to Online.
if mc_out=$(bun scripts/mc-status.ts 2>&1); then
  ok "$mc_out"
else
  warn "minecraft not ready yet:"
  echo "${DIM}${mc_out}${OFF}" | sed 's/^/       /'
  printf "       waiting up to 3min for it to finish booting (ctrl-c to give up)"
  booted=0
  for _ in $(seq 1 36); do
    printf "."
    sleep 5
    if mc_out=$(bun scripts/mc-status.ts 2>&1); then booted=1; break; fi
  done
  echo
  [ "$booted" = "1" ] || die "minecraft never came up. Start it at https://aternos.org"
  ok "$mc_out"
fi

# 2. Keys
[ -n "${GEMINI_API_KEY:-}" ] || die "GEMINI_API_KEY not set"
ok "gemini key present"
[ -n "${AGARTHA_DISCORD_TOKEN:-}" ] || die "AGARTHA_DISCORD_TOKEN not set"
ok "discord token present"

# 3. gbrain is optional; the agent talks fine without memory.
if curl -sf -m 2 http://127.0.0.1:3131/health >/dev/null 2>&1; then
  ok "gbrain up"
else
  warn "gbrain down — running without memory"
fi

# 4. Nothing already squatting the MCP port. A previous run that was killed
#    rather than stopped cleanly leaves the bot holding it. Reclaim OUR OWN
#    stale process automatically; refuse to touch anything else.
if lsof -nP -iTCP:"${MCP_PORT:-3001}" -sTCP:LISTEN >/dev/null 2>&1; then
  stale=$(pgrep -f "apps/mc-bot/src/index.ts" || true)
  if [ -n "$stale" ]; then
    warn "reclaiming stale agartha bot (pid $(echo "$stale" | tr '\n' ' '))"
    # shellcheck disable=SC2086
    kill $stale 2>/dev/null
    for _ in $(seq 1 10); do
      lsof -nP -iTCP:"${MCP_PORT:-3001}" -sTCP:LISTEN >/dev/null 2>&1 || break
      sleep 1
    done
    # shellcheck disable=SC2086
    lsof -nP -iTCP:"${MCP_PORT:-3001}" -sTCP:LISTEN >/dev/null 2>&1 && kill -9 $stale 2>/dev/null
    sleep 1
  fi
  if lsof -nP -iTCP:"${MCP_PORT:-3001}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  ${RED}FAIL${OFF} port ${MCP_PORT:-3001} is held by something that isn't an agartha bot:"
    lsof -nP -iTCP:"${MCP_PORT:-3001}" -sTCP:LISTEN 2>/dev/null | tail -n +2 | sed 's/^/       /'
    exit 1
  fi
fi
ok "port ${MCP_PORT:-3001} free"

echo
echo "starting. ${DIM}ctrl-c stops both.${OFF}"
echo

pids=()
cleanup() {
  echo
  echo "stopping"
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null; done
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# Bot first: the voice agent discovers its tools at connect.
mkdir -p .logs
: > .logs/bot.log
: > .logs/voice.log
echo "${DIM}logs: .logs/bot.log  .logs/voice.log${OFF}"
echo

bun --env-file=.env apps/mc-bot/src/index.ts 2>&1 | tee .logs/bot.log | sed -l "s/^/${GRN}[bot]${OFF}  /" &
pids+=($!)

# Give the bot time to spawn and bind MCP before the agent looks for tools.
until curl -sf -m 2 "http://127.0.0.1:${MCP_PORT:-3001}/health" >/dev/null 2>&1; do
  sleep 2
  kill -0 "${pids[0]}" 2>/dev/null || die "bot exited during startup"
done
echo "${GRN}[bot]${OFF}  MCP ready"

node --env-file=.env --import tsx apps/voice-agent/src/index.ts 2>&1 | tee .logs/voice.log | sed -l "s/^/${YEL}[voice]${OFF} /" &
pids+=($!)

wait
