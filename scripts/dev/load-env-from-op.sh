#!/usr/bin/env bash
# 從 1Password 載入 LINE Bot + Immich 憑證到目前 shell（勿 commit 輸出）
#
# 用法:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   npm run dev

set -euo pipefail

VAULT="${OP_VAULT:-Infra-Apps}"

if ! command -v op >/dev/null 2>&1; then
  echo "echo 'ERROR: op CLI not found'" >&2
  exit 1
fi

LINE_SECRET="$(op item get "Immich-LINE-Bot" --vault "$VAULT" --fields label=channel-secret --reveal)"
LINE_TOKEN="$(op item get "Immich-LINE-Bot" --vault "$VAULT" --fields label=access-token --reveal)"
IMMICH_KEY="$(op item get "Immich-API-Key" --vault "$VAULT" --fields label=api-key --reveal)"

cat <<EOF
export LINE_CHANNEL_SECRET='${LINE_SECRET//\'/\'\\\'\'}'
export LINE_CHANNEL_ACCESS_TOKEN='${LINE_TOKEN//\'/\'\\\'\'}'
export IMMICH_API_KEY='${IMMICH_KEY//\'/\'\\\'\'}'
export IMMICH_BASE_URL='${IMMICH_BASE_URL:-https://immich.3q.fi}'
export IMMICH_INSTANCE_URL='${IMMICH_INSTANCE_URL:-${IMMICH_BASE_URL:-https://immich.3q.fi}}'
export IMMICH_WEB_URL='${IMMICH_WEB_URL:-https://immich.3q.fi}'
export PORT='${PORT:-3000}'
EOF
