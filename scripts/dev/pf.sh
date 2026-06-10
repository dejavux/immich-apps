#!/usr/bin/env bash
# immich-apps port-forward — LINE Bot (30450)
set -eo pipefail

NS="${K8S_NAMESPACE:-immich}"
SVC="${IMMICH_LINE_BOT_SERVICE:-immich-line-bot}"
PORT="${PF_LOCAL_LINE_BOT_PORT:-30450}"
REMOTE_PORT="${IMMICH_LINE_BOT_REMOTE_PORT:-3000}"

tcp_port_in_use() {
  (echo >/dev/tcp/127.0.0.1/"${1}") &>/dev/null
}

if tcp_port_in_use "${PORT}"; then
  echo "ERROR: 127.0.0.1:${PORT} 已被占用" >&2
  exit 1
fi

if ! kubectl get svc -n "${NS}" "${SVC}" >/dev/null 2>&1; then
  echo "ERROR: 無 svc/${SVC}（namespace=${NS}）" >&2
  exit 1
fi

echo "Port-forward: ${NS}/svc/${SVC}"
echo "  127.0.0.1:${PORT} -> ${SVC}:${REMOTE_PORT}"
echo "  curl http://127.0.0.1:${PORT}/health"
echo "Ctrl+C 結束"

cleanup() {
  pkill -f "port-forward -n ${NS} svc/${SVC}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
pkill -f "port-forward -n ${NS} svc/${SVC}" 2>/dev/null || true
sleep 0.5

exec kubectl port-forward -n "${NS}" "svc/${SVC}" "${PORT}:${REMOTE_PORT}" --address=127.0.0.1
