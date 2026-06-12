# Immich Apps 規劃文件導覽

> `docs/00_planning/` 下所有規劃與規格文件的快速索引

**最後更新**: 2026-06-12（docs 目錄重整 · Phase 3 ~96% · v2.7.5 ✅）

---

## SSOT

| 文件 | 用途 |
|------|------|
| [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md) | 任務 checklist SSOT |
| [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md) | 現在該做什麼 |
| [BACKLOG.md](./BACKLOG.md) | Phase 4/5 與 V1.1 待辦池 |

---

## 子專案

### [LINE Bot](./line-bot/README.md)

Phase 2 MVP 已結案；V1.1 vision 描述等見 BACKLOG。

| 文件 | 說明 |
|------|------|
| [10_REQUIREMENTS.md](./line-bot/10_REQUIREMENTS.md) | 功能規格、Troubleshooting |

### [Photo Sync](./photo-sync/README.md)

Mac Photos Library → Immich CLI 同步（Phase 3）。

| 文件 | 說明 |
|------|------|
| [10_REQUIREMENTS.md](./photo-sync/10_REQUIREMENTS.md) | 需求與實作 |
| [runbooks/STORAGE_AUDIT.md](./photo-sync/runbooks/STORAGE_AUDIT.md) | 磁碟盤點 |
| [runbooks/EXTERNAL_LIBRARY_CLEANUP.md](./photo-sync/runbooks/EXTERNAL_LIBRARY_CLEANUP.md) | External library 清理 |

### [Infra](./infra/README.md)

K8s、Tekton、GPU、Immich server 升級。

| 文件 | 說明 |
|------|------|
| [K8S_DEPLOYMENT.md](./infra/K8S_DEPLOYMENT.md) | Helm / Tekton / HTTPS |
| [GPU_CONFIGURATION.md](./infra/GPU_CONFIGURATION.md) | GPU 節點配置 |
| [PORT_RANGE_PLAN.md](./infra/PORT_RANGE_PLAN.md) | Port 30450–30479 |
| [upgrades/IMMICH_v2.7.5.md](./infra/upgrades/IMMICH_v2.7.5.md) | v2.7.5 升級 checklist |

### [Repo](./repo/README.md)

Monorepo 整合決策（參考用）。

| 文件 | 說明 |
|------|------|
| [REPO_CONSOLIDATION_PLAN.md](./repo/REPO_CONSOLIDATION_PLAN.md) | 整合方案 |
| [REPO_ARCHITECTURE_RECOMMENDATION.md](./repo/REPO_ARCHITECTURE_RECOMMENDATION.md) | 架構建議 |

---

## 已結案

→ [../60_completed/README.md](../60_completed/README.md)

| 專案 | 歸檔 |
|------|------|
| Phase 0 Repo 整合 | [phase0-repo-consolidation/](../60_completed/phase0-repo-consolidation/) |
| Phase 2 LINE Bot MVP | [phase2-line-bot-mvp/](../60_completed/phase2-line-bot-mvp/) |
| Phase 3 Photo Sync 全量 | [phase3-photo-sync-bulk/](../60_completed/phase3-photo-sync-bulk/) |
| Immich v2.7.5 升級 | [immich-v2.7.5-upgrade/](../60_completed/immich-v2.7.5-upgrade/) |

---

## 指南

→ [../20_guides/COMMAND_REFERENCE.md](../20_guides/COMMAND_REFERENCE.md)

---

## 歷史

→ [../80_history/README.md](../80_history/README.md)
