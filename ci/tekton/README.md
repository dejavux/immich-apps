# immich-apps — Tekton CI / Release

**SSOT**: [docs/20_guides/infra/K8S_DEPLOYMENT.md](../docs/20_guides/infra/K8S_DEPLOYMENT.md)

## Status

| Component | Status |
| ----------- | -------- |
| `ci/tekton/release/` | ✅ Pipeline + Tasks |
| `ci/tekton/pr/` | ✅ L0（typecheck + eslint + helm lint） |
| `ci/tekton/triggers/` | ✅ GitHub PR → `immich-l0` |
| `ci-tenant-immich-apps` (infra-bootstrap) | ✅ Namespace + RBAC + bootstrap script |
| EventListener `triggerRef: immich-pr` | ✅ infra-bootstrap Tekton base |

## 首次設定（infra + secrets）

```bash
# infra-bootstrap（cluster 一次）
cd ../infra/infra-bootstrap
kubectl apply -k 60_apps/tekton-ci/kustomize/base/
bash 60_apps/tekton-ci/scripts/bootstrap-immich-apps-tenant-secrets.sh

# immich-apps
cd /Users/light0/DEV/immich-apps
make ci-apply-ci
```

## PR CI（L0）

Pipeline: `immich-l0` @ `ci-tenant-immich-apps`  
GitHub status context: `ci/k8s/immich`

套用：`make ci-apply-pr`（release 另用 `make ci-apply-release`）

## Release

```bash
make release              # Tekton build + helm deploy
make release-build        # 僅 build
make ci-release           # 同 release-build（不 deploy）
make ci-status
make ci-logs
```

Pipeline: `immich-release` @ `ci-tenant-immich-apps`  
Image: `registry.docker-registry-internal.svc.cluster.local:5000/immich-line-bot:<short-sha>`  
Helm pull: `registry-internal.3q.fi/immich-line-bot:<tag>`

## Prometheus

LINE Bot 暴露 `GET /metrics`（`prom-client`）。Helm 預設 pod annotations：

- `prometheus.io/scrape: "true"`
- `prometheus.io/path: /metrics`

Grafana dashboard 可對 `immich_line_bot_*` 指標建 panel（upload 成功率、imageSet batch 數、latency histogram）。

## References

- `ibkr-portfolio-miniapp/ci/tekton/`
- `infra-bootstrap/60_apps/tekton-ci/scripts/bootstrap-immich-apps-tenant-secrets.sh`
- `infra-bootstrap/60_apps/buildkit/docs/USAGE-CI.md`
