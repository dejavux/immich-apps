#!/usr/bin/env bash
# Post-deploy smoke test: Immich search APIs + Bot thumbnail proxy + pod env.
# LINE 對話需手動傳訊息；本腳本驗證後端依賴是否就緒。
#
# Usage:
#   bash scripts/line-bot/smoke-photo-search-e2e.sh
#   bash scripts/line-bot/smoke-photo-search-e2e.sh --person 小蕊
#   bash scripts/line-bot/smoke-photo-search-e2e.sh --person rayna
#   bash scripts/line-bot/smoke-photo-search-e2e.sh --scene "beach ocean"
#
set -euo pipefail

NAMESPACE="${NAMESPACE:-immich}"
BOT_HOST="${BOT_HOST:-https://immich-bot.3q.fi}"
IMMICH_BASE="${IMMICH_BASE:-https://immich.3q.fi}"
PERSON_NAME=""
SCENE_QUERY="beach ocean"
SEARCH_PERSON_ALIASES="${SEARCH_PERSON_ALIASES:-小蕊:rayna}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --person) PERSON_NAME="$2"; shift 2 ;;
    --scene) SCENE_QUERY="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,9p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "${IMMICH_API_KEY:-}" ]]; then
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
fi

if [[ -z "${IMMICH_API_KEY:-}" ]]; then
  echo "❌ 請設定 IMMICH_API_KEY 或建立 .env（可 eval \"\$(./scripts/dev/load-env-from-op.sh)\"）" >&2
  exit 1
fi

auth=(-H "x-api-key: ${IMMICH_API_KEY}")

resolve_person_alias() {
  local name="$1"
  local part alias immich
  IFS=',' read -ra parts <<< "$SEARCH_PERSON_ALIASES"
  for part in "${parts[@]}"; do
    alias="${part%%:*}"
    immich="${part#*:}"
    if [[ "$alias" == "$name" && -n "$immich" ]]; then
      echo "$immich"
      return
    fi
  done
  echo "$name"
}

echo "== 1) Bot pod 映像與搜尋 env =="
kubectl get deploy immich-line-bot -n "$NAMESPACE" \
  -o jsonpath='image={.spec.template.spec.containers[0].image}{"\n"}' 2>/dev/null || true
for key in PHOTO_SEARCH_ENABLED QWEN_BASE_URL LINE_BOT_PUBLIC_URL SEARCH_MAX_RESULTS SEARCH_PERSON_ALIASES; do
  val="$(kubectl get deploy immich-line-bot -n "$NAMESPACE" \
    -o "jsonpath={.spec.template.spec.containers[0].env[?(@.name==\"${key}\")].value}" 2>/dev/null || true)"
  echo "  ${key}=${val:-<unset>}"
done

echo ""
echo "== 2) Bot health =="
curl -fsS "${BOT_HOST}/health" | python3 -m json.tool

if [[ -n "$PERSON_NAME" ]]; then
  immich_name="$(resolve_person_alias "$PERSON_NAME")"
  echo ""
  echo "== 3) Immich GET /search/person?name=${PERSON_NAME} =="
  if [[ "$immich_name" != "$PERSON_NAME" ]]; then
    echo "  alias: ${PERSON_NAME} → ${immich_name}"
  fi
  encoded="$(python3 -c "import urllib.parse; print(urllib.parse.quote('${immich_name}'))")"
  person_json="$(curl -fsS "${auth[@]}" \
    "${IMMICH_BASE}/api/search/person?name=${encoded}&withHidden=false")"
  python3 -c "import json,sys; d=json.load(sys.stdin); print('count', len(d)); [print(' -', p.get('name'), p.get('id'), 'birthDate=', p.get('birthDate')) for p in d[:5]]" <<<"$person_json"
  if [[ "$(python3 -c "import json,sys; print(len(json.load(sys.stdin)))" <<<"$person_json")" == "0" ]]; then
    echo "  ⚠ 找不到人物。Immich People 頁面的名稱必須與 alias 右側一致（例：rayna）"
  fi
fi

echo ""
echo "== 4) Immich POST /search/smart query=${SCENE_QUERY} =="
smart_json="$(curl -fsS "${auth[@]}" -H "Content-Type: application/json" \
  -d "{\"query\":\"${SCENE_QUERY}\",\"size\":3}" \
  "${IMMICH_BASE}/api/search/smart")"
asset_id="$(python3 -c "import json,sys; d=json.load(sys.stdin); items=d.get('assets',{}).get('items',[]); print(items[0]['id'] if items else '')" <<<"$smart_json")"
python3 -c "import json,sys; d=json.load(sys.stdin); a=d.get('assets',{}); print('total', a.get('total',0), 'sample', [i.get('id') for i in a.get('items',[])[:3]])" <<<"$smart_json"

if [[ -n "$asset_id" ]]; then
  echo ""
  echo "== 5) Thumbnail proxy GET ${BOT_HOST}/media/assets/${asset_id}/preview.jpg =="
  code="$(curl -sS -o /tmp/bot-thumb.jpg -w "%{http_code}" "${BOT_HOST}/media/assets/${asset_id}/preview.jpg")"
  size="$(wc -c </tmp/bot-thumb.jpg | tr -d ' ')"
  echo "  http=${code} bytes=${size}"
  if [[ "$code" != "200" || "$size" -lt 100 ]]; then
    echo "❌ 縮圖 proxy 失敗（LINE Flex 需要 200 + 有效 JPEG）" >&2
    exit 1
  fi
fi

echo ""
echo "== 6) Qwen（從 Bot pod 連線） =="
if kubectl get deploy -n "$NAMESPACE" immich-line-bot &>/dev/null; then
  if kubectl exec -n "$NAMESPACE" deploy/immich-line-bot -- \
    wget -qO- --timeout=10 "http://qwen-coder.local-llm.svc.cluster.local:8001/v1/models" 2>/dev/null \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('models', [m['id'] for m in d.get('data',[])[:2]])" 2>/dev/null; then
    echo "  ✅ Qwen reachable from Bot pod"
  else
    echo "  ⚠ Qwen 連線失敗（Bot 會 fallback 規則解析）"
  fi
else
  echo "  skip（immich-line-bot deploy 不存在）"
fi

cat <<'EOF'

== 7) LINE 手動 E2E（部署後在 LINE 傳以下訊息）==

  A. 場景搜尋（V1.5 smart + Flex carousel）
     → 找在海邊的照片
     預期：文字摘要 + 橫向滑動縮圖；點縮圖開 Immich

  B. 人名 + 年齡（V1 metadata + Flex；暱稱 小蕊 → Immich rayna）
     → 幫我找小蕊一歲半的照片
     預期：若 rayna 有生日 → carousel；否則追問生日

  C. 追問流程
     → 生日 2019-03-15
     預期：依生日推算 1.5 歲區間並回傳結果

  D. 驗 log
     kubectl logs -n immich deploy/immich-line-bot --tail=80 | rg "Photo search"

EOF

echo "✅ Smoke 完成（LINE 對話請依步驟 7 手動驗）"
