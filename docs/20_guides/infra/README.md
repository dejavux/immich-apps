# Infra 維運指南

K8s、Tekton、GPU、Port、Immich server 升級等**操作手冊**（非專案需求規格）。

| 文件 | 用途 |
|------|------|
| [K8S_DEPLOYMENT.md](./K8S_DEPLOYMENT.md) | Tekton CI、Helm、HTTPS |
| [GPU_CONFIGURATION.md](./GPU_CONFIGURATION.md) | lama / worker3 GPU 分配 |
| [PORT_RANGE_PLAN.md](./PORT_RANGE_PLAN.md) | Port 30450–30479 |
| [upgrades/IMMICH_v2.7.5.md](./upgrades/IMMICH_v2.7.5.md) | v2.7.5 升級 checklist |

**Server manifest**: `infra-bootstrap/60_apps/immich/`  
**結案摘要**: [immich-v2.7.5-upgrade](../../60_completed/immich-v2.7.5-upgrade/)
