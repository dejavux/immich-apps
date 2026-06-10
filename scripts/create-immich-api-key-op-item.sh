#!/usr/bin/env bash
# 在 1Password 建立/更新 Immich-API-Key item
#
# 用法:
#   IMMICH_API_KEY='...' ./scripts/create-immich-api-key-op-item.sh
#
# 選填:
#   OP_VAULT (default: Infra-Apps)
#   OP_ITEM_TITLE (default: Immich-API-Key)

set -euo pipefail

VAULT="${OP_VAULT:-Infra-Apps}"
TITLE="${OP_ITEM_TITLE:-Immich-API-Key}"

if ! command -v op >/dev/null 2>&1; then
  echo "ERROR: 需要 1Password CLI (op)" >&2
  exit 1
fi

if [[ -z "${IMMICH_API_KEY:-}" ]]; then
  echo "ERROR: 請設定 IMMICH_API_KEY" >&2
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
    "api-key=${IMMICH_API_KEY}" \
    "notesPlain=Immich API key for LINE Bot upload. Base URL: https://immich.3q.fi" \
    >/dev/null
else
  echo "==> 建立 ${TITLE} @ ${VAULT}"
  op item create \
    --category="API Credential" \
    --title="$TITLE" \
    --vault="$VAULT" \
    "api-key=${IMMICH_API_KEY}" \
    "notesPlain=Immich API key for LINE Bot upload. Base URL: https://immich.3q.fi" \
    >/dev/null
fi

echo "OK — ${TITLE} @ ${VAULT}"
echo "    驗證: op item get \"${TITLE}\" --vault \"${VAULT}\" --fields label=api-key | wc -c"
