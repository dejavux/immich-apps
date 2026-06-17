#!/usr/bin/env bash
# 安裝 LaunchAgent：週日 03:30 tier ismissing 監控（dry-run gate）
#
# 用法:
#   ./scripts/photo-sync/install-tier-launchd.sh
#   ./scripts/photo-sync/install-tier-launchd.sh --uninstall
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLIST_LABEL="com.immich.photo-sync.tier"
PLIST_DST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
TEMPLATE="$ROOT/scripts/photo-sync/com.immich.photo-sync.tier.plist.example"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || \
    launchctl unload "$PLIST_DST" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "Removed $PLIST_DST"
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/Library/Logs/immich-photo-sync"

chmod +x "$ROOT/scripts/photo-sync/"*.sh

sed -e "s|__IMMICH_APPS_ROOT__|$ROOT|g" \
    -e "s|__HOME__|$HOME|g" \
    "$TEMPLATE" > "$PLIST_DST"

launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || \
  launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"

echo "Installed LaunchAgent: $PLIST_DST"
echo "Runs: tier-policy-monitor-ismissing.sh --cutoff-days 365 (Sunday 03:30)"
echo "Logs: ~/Library/Logs/immich-photo-sync/tier.launchd.*.log"
launchctl print "gui/$(id -u)/${PLIST_LABEL}" | head -15
