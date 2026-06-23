#!/usr/bin/env bash
# 1Password CLI 認證：桌面 signin 或 Connect（自動化／CI）
#
# Connect（無互動 signin）:
#   export OP_CONNECT_HOST=https://connect.example.com:8080
#   export OP_CONNECT_TOKEN=...
#
# 或 Service Account:
#   export OP_SERVICE_ACCOUNT_TOKEN=...
#
# shellcheck disable=SC2034
op_auth_check() {
  if ! command -v op >/dev/null 2>&1; then
    echo "ERROR: 需要 1Password CLI (op)" >&2
    return 1
  fi
  if op whoami &>/dev/null; then
    return 0
  fi
  if [[ -n "${OP_SERVICE_ACCOUNT_TOKEN:-}" ]]; then
    return 0
  fi
  if [[ -n "${OP_CONNECT_HOST:-}" && -n "${OP_CONNECT_TOKEN:-}" ]]; then
    return 0
  fi
  echo "ERROR: 請 eval \"\$(op signin)\" 或設定 OP_CONNECT_HOST+OP_CONNECT_TOKEN / OP_SERVICE_ACCOUNT_TOKEN" >&2
  return 1
}
