#!/usr/bin/env bash
# 安裝 LaunchAgent：fswatch 觸發 reconcile（預設 dry-run；auto_apply 見 config）
#
# 用法:
#   ./scripts/photo-sync/install-reconcile-watch-launchd.sh
#   ./scripts/photo-sync/install-reconcile-watch-launchd.sh --uninstall
#
# 前置: sync.reconcile.enabled=true 且 sync.reconcile.watch.enabled=true
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLIST_LABEL="com.immich.photo-sync.reconcile-watch"
PLIST_DST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
TEMPLATE="$ROOT/scripts/photo-sync/com.immich.photo-sync.reconcile-watch.plist.example"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || \
    launchctl unload "$PLIST_DST" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "Removed $PLIST_DST"
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/Library/Logs/immich-photo-sync/reconcile"
chmod +x "$ROOT/scripts/photo-sync/"*.sh

sed -e "s|__IMMICH_APPS_ROOT__|$ROOT|g" \
    -e "s|__HOME__|$HOME|g" \
    "$TEMPLATE" > "$PLIST_DST"

launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || \
  launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"

echo "Installed LaunchAgent: $PLIST_DST"
echo "Watches Mac library paths → debounced immich-reconcile.sh"
echo "Logs: ~/Library/Logs/immich-photo-sync/reconcile/watch.log"
