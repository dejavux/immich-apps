#!/usr/bin/env bash
# Post-deploy smoke test: Immich search APIs + Bot thumbnail proxy + pod env.
# LINE 對話需手動傳訊息；本腳本驗證後端依賴是否就緒。
#
# Usage:
#   bash scripts/line-bot/smoke-photo-search-e2e.sh
#   bash scripts/line-bot/smoke-photo-search-e2e.sh --person 小蕊
#   bash scripts/line-bot/smoke-photo-search-e2e.sh --scene "beach ocean"
#
set -euo pipefail

NAMESPACE="${NAMESPACE:-immich}"
BOT_HOST="${BOT_HOST:-https://immich-bot.3q.fi}"
IMMICH_BASE="${IMMICH_BASE:-https://immich.3q.fi}"
PERSON_NAME=""
SCENE_QUERY="beach ocean"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --person) PERSON_NAME="$2"; shift 2 ;;
    --scene) SCENE_QUERY="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,8p' "$0"
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
  echo "❌ 請設定 IMMICH_API_KEY 或建立 .env（可 source scripts/dev/load-env-from-op.sh）" >&2
  exit 1
fi

auth=(-H "x-api-key: ${IMMICH_API_KEY}")

echo "== 1) Bot pod 映像與搜尋 env =="
kubectl get deploy immich-line-bot -n "$NAMESPACE" \
  -o jsonpath='image={.spec.template.spec.containers[0].image}{"\n"}' 2>/dev/null || true
for key in PHOTO_SEARCH_ENABLED QWEN_BASE_URL LINE_BOT_PUBLIC_URL SEARCH_MAX_RESULTS; do
  val="$(kubectl get deploy immich-line-bot -n "$NAMESPACE" \
    -o "jsonpath={.spec.template.spec.containers[0].env[?(@.name==\"${key}\")].value}" 2>/dev/null || true)"
  echo "  ${key}=${val:-<unset>}"
done

echo ""
echo "== 2) Bot health =="
curl -fsS "${BOT_HOST}/health" | python3 -m json.tool

if [[ -n "$PERSON_NAME" ]]; then
  echo ""
  echo "== 3) Immich GET /search/person?name=${PERSON_NAME} =="
  encoded="$(python3 -c "import urllib.parse; print(urllib.parse.quote('${PERSON_NAME}'))")"
  curl -fsS "${auth[@]}" \
    "${IMMICH_BASE}/api/search/person?name=${encoded}&withHidden=false" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('count', len(d)); [print(' -', p.get('name'), p.get('id')) for p in d[:5]]"
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
echo "== 6) Qwen（叢集內，可選） =="
if kubectl get deploy -n local-llm qwen-coder &>/dev/null; then
  kubectl run qwen-smoke-$RANDOM --rm -i --restart=Never -n "$NAMESPACE" \
    --image=curlimages/curl:8.5.0 --command -- \
    curl -fsS -m 15 \
      -H "Content-Type: application/json" \
      -d '{"model":"default","messages":[{"role":"user","content":"reply ok"}],"max_tokens":8}' \
      "http://qwen-coder.local-llm.svc.cluster.local:8001/v1/chat/completions" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'][:80])" \
    || echo "  ⚠ Qwen 連線失敗（Bot 會 fallback 規則解析）"
else
  echo "  skip（local-llm/qwen-coder 不在此 cluster）"
fi

cat <<'EOF'

== 7) LINE 手動 E2E（部署後在 LINE 傳以下訊息）==

  A. 場景搜尋（V1.5 smart + Flex carousel）
     → 找在海邊的照片
     預期：文字摘要 + 橫向滑動縮圖；點縮圖開 Immich

  B. 人名 + 年齡（V1 metadata + Flex）
     → 幫我找小蕊一歲半的照片
     預期：若 Immich 有「小蕊」且設生日 → carousel；否則追問生日

  C. 追問流程
     → 生日 2019-03-15
     預期：依生日推算 1.5 歲區間並回傳結果

  D. 驗 log
     kubectl logs -n immich -l app=immich-line-bot --tail=80 | rg "Photo search"

EOF

echo "✅ Smoke 完成（LINE 對話請依步驟 7 手動驗）"
