#!/usr/bin/env bash
# Tekton release build: immich-release Pipeline (BuildKit daemonless).
#
# Usage: ./scripts/release-tekton-build.sh [build-target]
#   build-target: line-bot | all  (default: line-bot)
#
# Env:
#   IMMICH_TEKTON_TENANT_NS=ci-tenant-immich-apps
#   IMMICH_RELEASE_TIMEOUT=1800s
#   IMMICH_RELEASE_WAIT=1
#   IMMICH_REGISTRY=registry.docker-registry-internal.svc.cluster.local:5000
#
# Requires: kubectl, secrets github-clone + registry-push in ci-tenant-immich-apps
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -o allexport
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
  set +o allexport
fi

NS="${IMMICH_TEKTON_TENANT_NS:-ci-tenant-immich-apps}"
PIPELINE="${IMMICH_RELEASE_PIPELINE:-immich-release}"
RELEASE_KUSTOMIZE="$PROJECT_ROOT/ci/tekton/release"
TIMEOUT="${IMMICH_RELEASE_TIMEOUT:-1800s}"
BUILD_TARGET="${1:-line-bot}"
BASE_BRANCH="${PR_BASE_BRANCH:-master}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

case "$BUILD_TARGET" in
  line-bot | all) ;;
  *)
    echo -e "${RED}❌ unknown build-target: ${BUILD_TARGET} (use line-bot|all)${NC}" >&2
    exit 1
    ;;
esac

command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}❌ kubectl required${NC}" >&2; exit 1; }

if [[ ! -f "${RELEASE_KUSTOMIZE}/kustomization.yaml" ]]; then
  echo -e "${RED}❌ missing ${RELEASE_KUSTOMIZE}/kustomization.yaml${NC}" >&2
  exit 1
fi

if git fetch origin "${BASE_BRANCH}" 2>/dev/null; then
  AHEAD="$(git rev-list --count "origin/${BASE_BRANCH}..HEAD" 2>/dev/null || echo "0")"
  if [[ "${AHEAD:-0}" -gt 0 ]]; then
    echo -e "${RED}❌ 本機領先 origin/${BASE_BRANCH} ${AHEAD} 個 commit；請先 push 再 release${NC}" >&2
    git log "origin/${BASE_BRANCH}..HEAD" --oneline | head -10 >&2
    exit 1
  fi
fi

FULL_SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"
REGISTRY="${IMMICH_REGISTRY:-registry.docker-registry-internal.svc.cluster.local:5000}"
IMAGE_TAG="${IMAGE_TAG:-$SHORT_SHA}"

echo -e "${BLUE}=== Immich Apps Release Build ===${NC}"
echo "  namespace    : ${NS}"
echo "  revision     : ${SHORT_SHA}"
echo "  build-target : ${BUILD_TARGET}"
echo "  registry     : ${REGISTRY}"
echo "  image        : ${REGISTRY}/immich-line-bot:${IMAGE_TAG}"
echo ""

for secret in github-clone registry-push; do
  if ! kubectl get secret "$secret" -n "$NS" >/dev/null 2>&1; then
    echo -e "${RED}❌ missing secret ${secret} in ${NS}${NC}" >&2
    echo "Run: bash infra-bootstrap/60_apps/tekton-ci/scripts/bootstrap-immich-apps-tenant-secrets.sh" >&2
    exit 1
  fi
done

echo -e "${BLUE}Applying ci/tekton/release/ ...${NC}"
kubectl apply -k "${RELEASE_KUSTOMIZE}" >/dev/null

RUN_NAME="immich-release-${SHORT_SHA}-$(date +%H%M%S)"
echo -e "${BLUE}Creating PipelineRun: ${RUN_NAME}${NC}"

kubectl create -f - <<EOF
apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  name: ${RUN_NAME}
  namespace: ${NS}
  labels:
    app.kubernetes.io/part-of: immich-apps
    tekton.dev/pipeline: ${PIPELINE}
    tekton.dev/image-tag: ${IMAGE_TAG}
spec:
  pipelineRef:
    name: ${PIPELINE}
  params:
    - name: revision
      value: ${FULL_SHA}
    - name: registry
      value: ${REGISTRY}
    - name: image-tag
      value: ${IMAGE_TAG}
    - name: build-target
      value: ${BUILD_TARGET}
  workspaces:
    - name: source
      volumeClaimTemplate:
        spec:
          storageClassName: nfs-client
          accessModes:
            - ReadWriteMany
          resources:
            requests:
              storage: 16Gi
    - name: git-credentials
      secret:
        secretName: github-clone
    - name: dockerconfig
      secret:
        secretName: registry-push
  taskRunTemplate:
    serviceAccountName: tekton-ci-runner
    podTemplate:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: nvidia.com/gpu
                    operator: NotIn
                    values:
                      - "true"
  timeouts:
    pipeline: ${TIMEOUT}
EOF

echo ""
echo -e "${GREEN}✅ PipelineRun '${RUN_NAME}' 已建立${NC}"
echo ""
echo "追蹤進度："
echo "  kubectl -n ${NS} get pipelinerun ${RUN_NAME} -w"
echo "  kubectl -n ${NS} logs -l tekton.dev/pipelineRun=${RUN_NAME} -f --max-log-requests=10"
echo ""
echo "完成後部署："
echo "  make deploy-line-bot IMAGE_TAG=${IMAGE_TAG}"
echo ""

if [[ "${IMMICH_RELEASE_WAIT:-1}" == "1" ]]; then
  echo -e "${YELLOW}等待 PipelineRun 完成（最長 ${TIMEOUT}）...${NC}"
  if kubectl wait --for=condition=Succeeded "pipelinerun/${RUN_NAME}" \
      -n "${NS}" --timeout="${TIMEOUT}" 2>/dev/null; then
    echo -e "${GREEN}✅ Build 成功！映像 tag: ${IMAGE_TAG}${NC}"
  else
    echo -e "${RED}❌ Build 失敗或超時，查看 logs:${NC}"
    echo "  kubectl -n ${NS} describe pipelinerun ${RUN_NAME}"
    exit 1
  fi
fi
