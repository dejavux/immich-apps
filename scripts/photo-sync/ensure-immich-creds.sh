#!/usr/bin/env bash
# 載入 Immich 憑證：photo-sync.env → 1Password（略過 .env placeholder）
#
# 用法:
#   source "$(dirname "$0")/ensure-immich-creds.sh"
#   load_immich_creds "$ROOT"
#
load_immich_creds() {
  local root="${1:?root required}"
  local cred_file="${PHOTO_SYNC_ENV:-$HOME/.config/immich-apps/photo-sync.env}"
  local key="${IMMICH_API_KEY:-}"

  if [[ -f "$cred_file" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$cred_file" && set +a
    key="${IMMICH_API_KEY:-}"
  fi

  if [[ "$key" == "your-immich-api-key-here" || "$key" == your-* ]]; then
    key=""
    unset IMMICH_API_KEY
  fi

  if [[ -z "$key" ]]; then
    if command -v op >/dev/null 2>&1 && [[ -x "$root/scripts/dev/load-env-from-op.sh" ]]; then
      eval "$("$root/scripts/dev/load-env-from-op.sh")"
      key="${IMMICH_API_KEY:-}"
    fi
  fi

  if [[ -z "$key" || "$key" == "your-immich-api-key-here" ]]; then
    echo "ERROR: valid IMMICH_API_KEY not found." >&2
    echo "  Run: ./scripts/photo-sync/bootstrap-credentials.sh" >&2
    echo "  Or:  eval \"\$(./scripts/dev/load-env-from-op.sh)\"" >&2
    return 1
  fi

  export IMMICH_API_KEY="$key"
  export IMMICH_INSTANCE_URL="${IMMICH_INSTANCE_URL:-${IMMICH_BASE_URL:-https://immich.3q.fi}}"
}
