#!/usr/bin/env bash
# 將 Immich LINE Bot / API Key 從 Infra-Apps 同步至 Infra-Platform
# （immich namespace 的 1Password Connect 僅能讀 Infra-Platform，與 Immich-PostgreSQL 相同）
#
#   ./scripts/sync-op-items-infra-platform.sh
#
set -euo pipefail

SRC_VAULT="${OP_SRC_VAULT:-Infra-Apps}"
DST_VAULT="${OP_DST_VAULT:-Infra-Platform}"

if ! command -v op >/dev/null 2>&1; then
  echo "ERROR: 需要 op CLI" >&2
  exit 1
fi

copy_line_bot() {
  local title="Immich-LINE-Bot"
  if op item get "$title" --vault "$DST_VAULT" >/dev/null 2>&1; then
    echo "skip: ${title} @ ${DST_VAULT} 已存在"
    return 0
  fi
  if ! op item get "$title" --vault "$SRC_VAULT" >/dev/null 2>&1; then
    echo "ERROR: ${title} 不在 ${SRC_VAULT}" >&2
    return 1
  fi
  local channel_id channel_secret access_token bot_id
  channel_id="$(op read "op://${SRC_VAULT}/${title}/channel-id")"
  channel_secret="$(op read "op://${SRC_VAULT}/${title}/channel-secret")"
  access_token="$(op read "op://${SRC_VAULT}/${title}/access-token")"
  bot_id="$(op read "op://${SRC_VAULT}/${title}/bot-id" 2>/dev/null || echo @189oipta)"
  echo "==> 建立 ${title} @ ${DST_VAULT}"
  op item create \
    --category="API Credential" \
    --title="$title" \
    --vault="$DST_VAULT" \
    "channel-id=${channel_id}" \
    "channel-secret=${channel_secret}" \
    "access-token=${access_token}" \
    "bot-id=${bot_id}" \
    "notesPlain=Synced from ${SRC_VAULT} for immich namespace Connect (Infra-Platform only)" \
    >/dev/null
  echo "OK: ${title} @ ${DST_VAULT}"
}

copy_api_key() {
  local title="Immich-API-Key"
  if op item get "$title" --vault "$DST_VAULT" >/dev/null 2>&1; then
    echo "skip: ${title} @ ${DST_VAULT} 已存在"
    return 0
  fi
  if ! op item get "$title" --vault "$SRC_VAULT" >/dev/null 2>&1; then
    echo "ERROR: ${title} 不在 ${SRC_VAULT}" >&2
    return 1
  fi
  local api_key
  api_key="$(op read "op://${SRC_VAULT}/${title}/api-key")"
  echo "==> 建立 ${title} @ ${DST_VAULT}"
  op item create \
    --category="API Credential" \
    --title="$title" \
    --vault="$DST_VAULT" \
    "api-key=${api_key}" \
    "notesPlain=Synced from ${SRC_VAULT} for immich-line-bot Helm" \
    >/dev/null
  echo "OK: ${title} @ ${DST_VAULT}"
}

copy_line_bot
copy_api_key
echo "完成。請 helm upgrade 後等待 OnePasswordItem Ready。"
