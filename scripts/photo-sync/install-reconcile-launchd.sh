#!/usr/bin/env bash
# 安裝 LaunchAgent：週日 04:00 dry-run reconcile（預設不 --apply）
#
# 用法:
#   ./scripts/photo-sync/install-reconcile-launchd.sh
#   ./scripts/photo-sync/install-reconcile-launchd.sh --uninstall
#
# 若要排程自動 trash orphan，請在 config 設 sync.delete_policy: conservative
# 並手動改 plist 加入 --apply --confirm（不建議未驗 dry-run 前啟用）。
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLIST_LABEL="com.immich.photo-sync.reconcile"
PLIST_DST="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
TEMPLATE="$ROOT/scripts/photo-sync/com.immich.photo-sync.reconcile.plist.example"

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
echo "Schedule: Sunday 04:00 — dry-run reconcile"
echo "Logs: ~/Library/Logs/immich-photo-sync/reconcile.launchd.*.log"
