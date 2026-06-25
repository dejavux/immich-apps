#!/usr/bin/env bash
# Compare LINE Bot image in cluster vs git HEAD / last release tag.
set -euo pipefail

NAMESPACE="${NAMESPACE:-immich}"
SELECTOR='app.kubernetes.io/name=immich-line-bot'
REGISTRY_PREFIX='registry-internal.3q.fi/immich-line-bot:'

git_head="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
deploy_image="$(kubectl get deploy immich-line-bot -n "$NAMESPACE" \
  -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"
pod_image="$(kubectl get pods -n "$NAMESPACE" -l "$SELECTOR" \
  -o jsonpath='{.items[0].spec.containers[0].image}' 2>/dev/null || true)"
pod_started="$(kubectl get pods -n "$NAMESPACE" -l "$SELECTOR" \
  -o jsonpath='{.items[0].status.startTime}' 2>/dev/null || true)"
helm_rev="$(helm list -n "$NAMESPACE" -f '^immich-line-bot$' -o json 2>/dev/null \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['revision'] if d else 'n/a')" 2>/dev/null || echo n/a)"

deploy_tag="${deploy_image#"${REGISTRY_PREFIX}"}"
pod_tag="${pod_image#"${REGISTRY_PREFIX}"}"

echo "=== LINE Bot deploy verify ==="
echo "git HEAD:        ${git_head}"
echo "deploy image:    ${deploy_image:-<missing>}"
echo "pod image:       ${pod_image:-<missing>}"
echo "pod started:     ${pod_started:-<missing>}"
echo "helm revision:   ${helm_rev}"
echo ""

status=0

if [[ -z "$deploy_image" || -z "$pod_image" ]]; then
  echo "FAIL: deployment or pod not found"
  exit 1
fi

if [[ "$deploy_tag" != "$pod_tag" ]]; then
  echo "FAIL: deploy tag (${deploy_tag}) != pod tag (${pod_tag}) — rollout 可能未完成"
  status=1
else
  echo "OK: deploy 與 pod tag 一致 (${deploy_tag})"
fi

if [[ "$git_head" == "$deploy_tag" ]]; then
  echo "OK: git HEAD 與 cluster image 相同"
elif git cat-file -e "${deploy_tag}^{commit}" 2>/dev/null; then
  if git diff --quiet "${deploy_tag}" HEAD -- \
    Dockerfile.line-bot \
    src/line-bot \
    src/shared \
    package.json \
    package-lock.json \
    deploy/helm/immich-line-bot 2>/dev/null; then
    echo "OK: git HEAD (${git_head}) 領先 image (${deploy_tag})，但 LINE Bot 程式未變更（僅 docs/ops）"
  else
    echo "WARN: git HEAD (${git_head}) 領先 image (${deploy_tag})，且 LINE Bot 相關檔案有變更 → 需要 make release"
    status=1
  fi
else
  echo "WARN: 無法比對 ${deploy_tag} 與 git（可能為舊 tag）"
fi

echo ""
if [[ $status -eq 0 ]]; then
  echo "RESULT: PASS"
else
  echo "RESULT: NEED RELEASE 或等待 rollout"
fi
exit $status
