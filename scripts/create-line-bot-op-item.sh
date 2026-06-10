#!/usr/bin/env bash
# 在 1Password 建立/更新 Immich-LINE-Bot item
#
# 用法（勿在 shell history 留明文；建議從 .env 載入）:
#   set -a && source .env.line-bot-secrets && set +a
#   ./scripts/create-line-bot-op-item.sh
#
# 必要環境變數:
#   LINE_CHANNEL_SECRET
#   LINE_ACCESS_TOKEN
# 選填:
#   LINE_CHANNEL_ID (default: 2010362663)
#   LINE_BOT_ID     (default: @189oipta)
#   OP_VAULT        (default: Infra-Apps)

set -euo pipefail

VAULT="${OP_VAULT:-Infra-Apps}"
TITLE="${OP_ITEM_TITLE:-Immich-LINE-Bot}"
CHANNEL_ID="${LINE_CHANNEL_ID:-2010362663}"
BOT_ID="${LINE_BOT_ID:-@189oipta}"

if ! command -v op >/dev/null 2>&1; then
  echo "ERROR: 需要 1Password CLI (op)" >&2
  exit 1
fi

if [[ -z "${LINE_CHANNEL_SECRET:-}" || -z "${LINE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: 請設定 LINE_CHANNEL_SECRET 與 LINE_ACCESS_TOKEN" >&2
  exit 1
fi

if ! op vault get "$VAULT" >/dev/null 2>&1; then
  echo "==> 建立 vault: ${VAULT}"
  op vault create "$VAULT" --description "Infra application secrets (Immich, etc.)"
fi

EXISTING_ID="$(op item list --vault "$VAULT" --format json 2>/dev/null | python3 -c "
import json, sys
title = sys.argv[1]
for i in json.load(sys.stdin):
    if i.get('title') == title:
        print(i['id'])
        break
" "$TITLE" 2>/dev/null || true)"

if [[ -n "${EXISTING_ID:-}" ]]; then
  echo "==> 更新 ${TITLE} (${EXISTING_ID}) @ ${VAULT}"
  op item edit "$EXISTING_ID" --vault "$VAULT" \
    "channel-id=${CHANNEL_ID}" \
    "channel-secret=${LINE_CHANNEL_SECRET}" \
    "access-token=${LINE_ACCESS_TOKEN}" \
    "bot-id=${BOT_ID}" \
    "notesPlain=LINE Official Account: 分享照片. Managed by immich-apps/scripts/create-line-bot-op-item.sh" \
    >/dev/null
else
  echo "==> 建立 ${TITLE} @ ${VAULT}"
  op item create \
    --category="API Credential" \
    --title="$TITLE" \
    --vault="$VAULT" \
    "channel-id=${CHANNEL_ID}" \
    "channel-secret=${LINE_CHANNEL_SECRET}" \
    "access-token=${LINE_ACCESS_TOKEN}" \
    "bot-id=${BOT_ID}" \
    "notesPlain=LINE Official Account: 分享照片. Managed by immich-apps/scripts/create-line-bot-op-item.sh" \
    >/dev/null
fi

echo "OK — ${TITLE} @ ${VAULT} (channel-id=${CHANNEL_ID}, bot-id=${BOT_ID})"
echo "    驗證: op item get \"${TITLE}\" --vault \"${VAULT}\" --fields label=channel-id"
