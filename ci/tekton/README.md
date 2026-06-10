# immich-apps — Tekton CI / Release

**SSOT**: [docs/PHASE2_K8S_DEPLOYMENT.md](../docs/PHASE2_K8S_DEPLOYMENT.md)

## Status

| Component | Status |
|-----------|--------|
| `ci/tekton/release/` manifests | ⏳ Planned |
| `ci-tenant-immich-apps` (infra-bootstrap) | ⏳ Planned |
| BuildKit release Task | ⏳ Copy/adapt from fuqi-asset-manager |

## Target

```bash
make release IMAGE_TAG=$(git rev-parse --short HEAD)
```

Pipeline: git clone → BuildKit (`Dockerfile.line-bot`) → optional helm deploy.

## References

- `fuqi-asset-manager/ci/tekton/release/`
- `infra-bootstrap/60_apps/buildkit/docs/USAGE-CI.md`
- `infra-bootstrap/60_apps/tekton-ci/scripts/bootstrap-fuqi-asset-manager-tenant-secrets.sh`
