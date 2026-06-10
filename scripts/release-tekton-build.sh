#!/usr/bin/env bash
# Tekton release build: immich-line-bot（BuildKit）。
#
# Usage: ./scripts/release-tekton-build.sh [line-bot]
#
# Env:
#   IMMICH_TEKTON_TENANT_NS=ci-tenant-immich-apps
#   IMMICH_RELEASE_TIMEOUT=1800s
#   IMMICH_RELEASE_SKIP_DEPLOY=1   # 只 build，不 helm deploy
#   IMMICH_REGISTRY=registry-internal.3q.fi
#
# Tekton pipeline 就緒前：fallback 至本機 docker build + push。
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

NS="${IMMICH_TEKTON_TENANT_NS:-ci-tenant-immich-apps}"
PIPELINE="${IMMICH_RELEASE_PIPELINE:-immich-release}"
RELEASE_KUSTOMIZE="$PROJECT_ROOT/ci/tekton/release"
TIMEOUT="${IMMICH_RELEASE_TIMEOUT:-1800s}"
BUILD_TARGET="${1:-line-bot}"
REGISTRY="${IMMICH_REGISTRY:-registry-internal.3q.fi}"
SKIP_DEPLOY="${IMMICH_RELEASE_SKIP_DEPLOY:-0}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

case "$BUILD_TARGET" in
  line-bot) IMAGE_NAME="immich-line-bot" ;;
  *)
    echo -e "${RED}❌ unknown build-target: ${BUILD_TARGET}（目前僅 line-bot）${NC}" >&2
    exit 1
    ;;
esac

FULL_SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"
IMAGE_TAG="${IMAGE_TAG:-$SHORT_SHA}"

echo -e "${BLUE}=== Immich Apps Release Build ===${NC}"
echo "  target   : ${BUILD_TARGET}"
echo "  image    : ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
echo "  revision : ${SHORT_SHA}"
echo ""

# Tekton pipeline 尚未就緒 → fallback
if [[ ! -f "${RELEASE_KUSTOMIZE}/kustomization.yaml" ]]; then
  echo -e "${YELLOW}⚠ ci/tekton/release/ 尚未就緒，使用本機 docker build${NC}"
  echo -e "${YELLOW}  完成 Tekton 後見 docs/PHASE2_K8S_DEPLOYMENT.md${NC}"
  echo ""
  docker build -f Dockerfile.line-bot -t "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}" .
  docker push "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
  echo -e "${GREEN}✅ 本機 build + push 完成${NC}"
  exit 0
fi

command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}❌ kubectl required${NC}" >&2; exit 1; }

BASE_BRANCH="${PR_BASE_BRANCH:-master}"
if git fetch origin "${BASE_BRANCH}" 2>/dev/null; then
  AHEAD="$(git rev-list --count "origin/${BASE_BRANCH}..HEAD" 2>/dev/null || echo "0")"
  if [[ "${AHEAD:-0}" -gt 0 ]]; then
    echo -e "${RED}❌ 本機領先 origin/${BASE_BRANCH} ${AHEAD} 個 commit；請先 push 再 release${NC}" >&2
    exit 1
  fi
fi

for secret in github-clone registry-push; do
  if ! kubectl get secret "$secret" -n "$NS" >/dev/null 2>&1; then
    echo -e "${RED}❌ missing secret ${secret} in ${NS}${NC}" >&2
    echo "Run: bash infra-bootstrap/60_apps/tekton-ci/scripts/bootstrap-immich-apps-tenant-secrets.sh" >&2
    exit 1
  fi
done

echo -e "${BLUE}Applying ci/tekton/release/ ...${NC}"
kubectl apply -k "${RELEASE_KUSTOMIZE}" >/dev/null

RUN_NAME="immich-release-${SHORT_SHA}-$(date +%s)"
echo -e "${BLUE}Creating PipelineRun ${RUN_NAME} ...${NC}"

kubectl create -f - <<EOF
apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  generateName: immich-release-
  namespace: ${NS}
spec:
  pipelineRef:
    name: ${PIPELINE}
  params:
    - name: revision
      value: ${FULL_SHA}
    - name: image-tag
      value: ${IMAGE_TAG}
    - name: build-target
      value: ${BUILD_TARGET}
    - name: registry
      value: ${REGISTRY}
  taskRunTemplate:
    serviceAccountName: tekton-runner
  timeouts:
    pipeline: ${TIMEOUT}
EOF

echo -e "${GREEN}✅ PipelineRun 已建立（namespace=${NS}）${NC}"
echo "  tkn pipelinerun logs -f -n ${NS} --last"
echo ""
echo -e "${YELLOW}💡 部署: make deploy-line-bot IMAGE_TAG=${IMAGE_TAG}${NC}"

if [[ "$SKIP_DEPLOY" == "1" ]]; then
  echo -e "${YELLOW}IMMICH_RELEASE_SKIP_DEPLOY=1，略過 helm deploy${NC}"
fi
