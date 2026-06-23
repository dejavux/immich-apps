#!/usr/bin/env bash
# 刪除 Immich-B2-Backup（Infra-Apps + Infra-Platform）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IB="${ROOT}/../infra/infra-bootstrap/60_apps/immich/scripts/delete-immich-b2-backup-op-item.sh"
if [[ -x "$IB" ]]; then
  exec bash "$IB"
fi
IB2="${ROOT}/../infra-bootstrap/60_apps/immich/scripts/delete-immich-b2-backup-op-item.sh"
if [[ -x "$IB2" ]]; then
  exec bash "$IB2"
fi
echo "ERROR: 找不到 infra-bootstrap delete-immich-b2-backup-op-item.sh" >&2
exit 1
