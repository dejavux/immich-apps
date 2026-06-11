#!/usr/bin/env bash
# Dry-run / execute cleanup of redundant external-library copies on Immich node.
# See docs/PHASE3_EXTERNAL_LIBRARY_CLEANUP.md
set -euo pipefail

EXECUTE=0
NODE="${IMMICH_NODE:-lama}"
NAMESPACE="${IMMICH_NAMESPACE:-immich}"

usage() {
  cat <<'EOF'
Usage: cleanup-external-library.sh [--execute]

Default: dry-run only (print du + file counts).

Paths (on node hostPath / PVC):
  /mnt/immich/external-library     hostPath mount (~43 GB legacy rsync)
  /data/external-library           PVC duplicate (inside immich-server pod)

Prerequisites:
  - local-archive upload complete + Immich UI verified
  - External library "Migrated photos" assetCount still 0
  - SSH/kubectl access to cluster

EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

log() { printf '[cleanup-external-library] %s\n' "$*"; }

check_asset_count() {
  log "Checking external library assetCount via immich-server API..."
  kubectl exec -n "$NAMESPACE" deploy/immich-server -- \
    wget -qO- http://127.0.0.1:2283/api/server-info 2>/dev/null \
    | head -c 2000 || true
  log "(Confirm in Immich Admin → External Libraries: assetCount = 0)"
}

inspect_paths() {
  local label="$1"
  local path="$2"
  log "=== $label: $path ==="
  kubectl exec -n "$NAMESPACE" deploy/immich-server -- \
    sh -c "du -sh '$path' 2>/dev/null || echo 'path missing'; find '$path' -type f 2>/dev/null | wc -l | xargs echo files:"
}

remove_path() {
  local label="$1"
  local path="$2"
  if [[ "$EXECUTE" -eq 0 ]]; then
    log "[dry-run] would remove: $label ($path)"
    return
  fi
  log "Removing $label ($path)..."
  kubectl exec -n "$NAMESPACE" deploy/immich-server -- \
    sh -c "rm -rf '$path' && mkdir -p '$path'"
}

log "Node hint: $NODE · namespace: $NAMESPACE · execute=$EXECUTE"
check_asset_count
inspect_paths "hostPath external-library" "/external-library"
inspect_paths "PVC external-library" "/data/external-library"

if [[ "$EXECUTE" -eq 0 ]]; then
  log ""
  log "Dry-run complete. Re-run with --execute after UI verification."
  exit 0
fi

read -r -p "Type YES to delete both external-library copies: " confirm
if [[ "$confirm" != "YES" ]]; then
  log "Aborted."
  exit 1
fi

remove_path "hostPath external-library" "/external-library"
remove_path "PVC external-library" "/data/external-library"
log "Done. Re-check disk: kubectl exec -n $NAMESPACE deploy/immich-server -- du -sh /data/*"
