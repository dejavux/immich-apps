#!/usr/bin/env bash
# 確保 Immich 相關 1Password item 存在於 Infra-Apps，並同步至 Infra-Platform（K8s Operator）
#
# 認證（擇一）:
#   eval "$(op signin)"
#   OP_CONNECT_HOST + OP_CONNECT_TOKEN
#   OP_SERVICE_ACCOUNT_TOKEN
#
# 用法:
#   ./scripts/bootstrap-immich-op-vault.sh
#   ./scripts/bootstrap-immich-op-vault.sh --sync-k8s
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/op-auth.sh
source "${ROOT}/scripts/lib/op-auth.sh"

APPS_VAULT="${OP_APPS_VAULT:-Infra-Apps}"
PLATFORM_VAULT="${OP_PLATFORM_VAULT:-Infra-Platform}"
SYNC_K8S=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sync-k8s) SYNC_K8S=1; shift ;;
    -h|--help)
      sed -n '1,14p' "$0" | tail -n +2
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

op_auth_check

log() { echo "==> $*"; }
skip() { echo "skip: $*"; }

item_in_vault() {
  op item get "$1" --vault "$2" &>/dev/null
}

upsert_postgresql_apps_from_platform() {
  local title="Immich-PostgreSQL"
  if item_in_vault "$title" "$APPS_VAULT"; then
    skip "${title} @ ${APPS_VAULT}"
    return 0
  fi
  if ! item_in_vault "$title" "$PLATFORM_VAULT"; then
    echo "ERROR: ${title} 不在 ${PLATFORM_VAULT}，無法複製到 ${APPS_VAULT}" >&2
    return 1
  fi
  log "複製 ${title}: ${PLATFORM_VAULT} → ${APPS_VAULT}"
  local user pass db host port
  user="$(op read "op://${PLATFORM_VAULT}/${title}/username")"
  pass="$(op read "op://${PLATFORM_VAULT}/${title}/password")"
  db="$(op read "op://${PLATFORM_VAULT}/${title}/database" 2>/dev/null || echo immich)"
  host="$(op read "op://${PLATFORM_VAULT}/${title}/hostname" 2>/dev/null || op read "op://${PLATFORM_VAULT}/${title}/server" 2>/dev/null || echo immich-postgres)"
  port="$(op read "op://${PLATFORM_VAULT}/${title}/port" 2>/dev/null || echo 5432)"
  op item create --category database --title "$title" --vault "$APPS_VAULT" \
    "username=${user}" \
    "password=${pass}" \
    "database=${db}" \
    "hostname=${host}" \
    "port=${port}" \
    "server=${host}" \
    "notesPlain=Synced from ${PLATFORM_VAULT} for Infra-Apps SSOT" \
    >/dev/null
  echo "OK: ${title} @ ${APPS_VAULT}"
}

sync_postgresql_to_platform() {
  local title="Immich-PostgreSQL"
  if item_in_vault "$title" "$PLATFORM_VAULT"; then
    skip "${title} @ ${PLATFORM_VAULT}（已存在，不覆寫 prod）"
    return 0
  fi
  if ! item_in_vault "$title" "$APPS_VAULT"; then
    return 0
  fi
  log "同步 ${title}: ${APPS_VAULT} → ${PLATFORM_VAULT}"
  local user pass db host port
  user="$(op read "op://${APPS_VAULT}/${title}/username")"
  pass="$(op read "op://${APPS_VAULT}/${title}/password")"
  db="$(op read "op://${APPS_VAULT}/${title}/database" 2>/dev/null || echo immich)"
  host="$(op read "op://${APPS_VAULT}/${title}/hostname" 2>/dev/null || echo immich-postgres)"
  port="$(op read "op://${APPS_VAULT}/${title}/port" 2>/dev/null || echo 5432)"
  op item create --category database --title "$title" --vault "$PLATFORM_VAULT" \
    "username=${user}" \
    "password=${pass}" \
    "database=${db}" \
    "hostname=${host}" \
    "port=${port}" \
    "server=${host}" \
    >/dev/null
  echo "OK: ${title} @ ${PLATFORM_VAULT}"
}

upsert_redis() {
  local title="Immich-Redis"
  local pass="${REDIS_PASSWORD:-}"
  if [[ -z "$pass" ]]; then
    pass="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
  fi
  if item_in_vault "$title" "$APPS_VAULT"; then
    skip "${title} @ ${APPS_VAULT}"
  else
    log "建立 ${title} @ ${APPS_VAULT}"
    op item create --vault "$APPS_VAULT" --category Password --title "$title" \
      "password[concealed]=${pass}" \
      "notesPlain=Immich Valkey requirepass" \
      >/dev/null
  fi
  pass="$(op read "op://${APPS_VAULT}/${title}/password")"
  if item_in_vault "$title" "$PLATFORM_VAULT"; then
    log "更新 ${title} @ ${PLATFORM_VAULT}"
    op item edit "$title" --vault "$PLATFORM_VAULT" "password[concealed]=${pass}" >/dev/null
  else
    log "建立 ${title} @ ${PLATFORM_VAULT}"
    op item create --vault "$PLATFORM_VAULT" --category Password --title "$title" \
      "password[concealed]=${pass}" >/dev/null
  fi
  echo "OK: ${title}"
}

sync_line_and_api() {
  if [[ -x "${ROOT}/scripts/sync-op-items-infra-platform.sh" ]]; then
    log "同步 LINE Bot + API Key → Platform"
    bash "${ROOT}/scripts/sync-op-items-infra-platform.sh"
  fi
}

maybe_k8s_sync() {
  [[ "$SYNC_K8S" == "1" ]] || return 0
  local ib="${ROOT}/../infra/infra-bootstrap/60_apps/immich"
  if [[ ! -d "$ib" ]]; then
    ib="${ROOT}/../infra-bootstrap/60_apps/immich"
  fi
  if [[ -x "${ib}/scripts/bootstrap-immich-secrets.sh" ]]; then
    bash "${ib}/scripts/bootstrap-immich-secrets.sh"
  else
    echo "WARN: 找不到 infra-bootstrap bootstrap-immich-secrets.sh" >&2
  fi
}

upsert_postgresql_apps_from_platform
sync_postgresql_to_platform
upsert_redis
sync_line_and_api
maybe_k8s_sync

echo "完成。Infra-Apps: Immich-PostgreSQL, Immich-Redis, Immich-LINE-Bot, Immich-API-Key"
