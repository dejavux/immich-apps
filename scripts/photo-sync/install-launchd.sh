#!/usr/bin/env bash
# 安裝 LaunchAgent：fswatch 增量同步 Immich
#
# 用法:
#   ./scripts/photo-sync/install-launchd.sh
#   ./scripts/photo-sync/install-launchd.sh --uninstall
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLIST_LABEL="com.immich.photo-sync.watch"
PLIST_DST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
TEMPLATE="$ROOT/scripts/photo-sync/com.immich.photo-sync.watch.plist.example"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || \
    launchctl unload "$PLIST_DST" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "Removed $PLIST_DST"
  exit 0
fi

if ! command -v fswatch >/dev/null 2>&1; then
  echo "Installing fswatch..."
  brew install fswatch
fi

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/Library/Logs/immich-photo-sync"
mkdir -p "$HOME/.config/immich-apps"

if [[ ! -f "$HOME/.config/immich-apps/photo-sync.config.yaml" ]]; then
  cp "$ROOT/scripts/photo-sync/photo-sync.config.yaml.example" \
    "$HOME/.config/immich-apps/photo-sync.config.yaml"
  echo "Created ~/.config/immich-apps/photo-sync.config.yaml — review paths"
fi

chmod +x "$ROOT/scripts/photo-sync/"*.sh

sed -e "s|__IMMICH_APPS_ROOT__|$ROOT|g" \
    -e "s|__HOME__|$HOME|g" \
    "$TEMPLATE" > "$PLIST_DST"

launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || \
  launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"

echo "Installed LaunchAgent: $PLIST_DST"
echo "Logs: ~/Library/Logs/immich-photo-sync/watch.launchd.*.log"
launchctl print "gui/$(id -u)/${PLIST_LABEL}" | head -20
