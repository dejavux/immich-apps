# immich-apps — Tekton CI / Release

**SSOT**: [docs/PHASE2_K8S_DEPLOYMENT.md](../docs/PHASE2_K8S_DEPLOYMENT.md)

## Status

| Component | Status |
|-----------|--------|
| `ci/tekton/release/` | ✅ Pipeline + Tasks |
| `ci-tenant-immich-apps` (infra-bootstrap) | ✅ Namespace + RBAC + bootstrap script |
| PR CI triggers | ⏳ Planned |

## 首次設定（infra + secrets）

```bash
# infra-bootstrap（cluster 一次）
cd ../infra/infra-bootstrap
kubectl apply -k 60_apps/tekton-ci/kustomize/base/
bash 60_apps/tekton-ci/scripts/bootstrap-immich-apps-tenant-secrets.sh

# immich-apps
cd /Users/light0/DEV/immich-apps
make ci-apply-release
```

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

## References

- `ibkr-portfolio-miniapp/ci/tekton/release/`
- `infra-bootstrap/60_apps/tekton-ci/scripts/bootstrap-immich-apps-tenant-secrets.sh`
- `infra-bootstrap/60_apps/buildkit/docs/USAGE-CI.md`
