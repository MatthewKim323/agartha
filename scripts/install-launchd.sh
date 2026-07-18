#!/bin/bash
#
# Install the voice agent as a LaunchAgent.
#
# Run this yourself from a terminal. The agent must never invoke it on its own:
# in jabby, agent-triggered launchctl load/unload historically caused respawn
# loops, which is why the repo-level installer there is a deliberate stub.

set -euo pipefail

AGARTHA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.matthewkim.agartha"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
TEMPLATE="$AGARTHA_DIR/scripts/$LABEL.plist.template"

echo "installing $LABEL"
echo "  repo: $AGARTHA_DIR"

if [ ! -f "$AGARTHA_DIR/.env" ]; then
  echo "  ERROR: no .env. Copy .env.example and fill it in first." >&2
  exit 1
fi

mkdir -p "$HOME/.agartha" "$HOME/Library/LaunchAgents"
chmod +x "$AGARTHA_DIR/scripts/launch.sh"

sed -e "s|__AGARTHA_DIR__|$AGARTHA_DIR|g" -e "s|__HOME__|$HOME|g" "$TEMPLATE" > "$PLIST"
echo "  wrote $PLIST"

# bootout first so a re-install replaces cleanly instead of erroring.
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "  loaded"

sleep 2
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "  running. logs: ~/.agartha/agent.{out,err}.log"
else
  echo "  WARNING: not running. check ~/.agartha/agent.err.log" >&2
fi

cat <<EOF

  stop:    launchctl bootout gui/\$(id -u)/$LABEL
  restart: launchctl kickstart -k gui/\$(id -u)/$LABEL
  logs:    tail -f ~/.agartha/agent.err.log
EOF
