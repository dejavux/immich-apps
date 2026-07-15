# Immich Apps 規劃文件導覽

> `docs/00_planning/` — **進行中專案需求** only

**最後更新**: 2026-07-15（Family Memories Phase A 實作計畫）

---

## SSOT

| 文件 | 用途 |
| ------ | ------ |
| [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md) | 任務 checklist SSOT |
| [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md) | 本週 Sprint |
| [BACKLOG.md](./BACKLOG.md) | 待辦優先序 |
| [UX_PRODUCT_REVIEW.md](./UX_PRODUCT_REVIEW.md) | UI/UX/Flow 檢視與下一階段建議 |
| [FAMILY_MEMORIES_ARCHITECTURE.md](./FAMILY_MEMORIES_ARCHITECTURE.md) | Family Memories 平台架構（MCP-first · planner · 三期） |

---

## 進行中專案

### [Family Memories](./FAMILY_MEMORIES_ARCHITECTURE.md)

行前 `apps/planner`（wizard、旅行社 extract）＋行後 Memory 路線圖；repo 演進 `family-memories`。

| 文件 | 說明 |
| ------ | ------ |
| [FAMILY_MEMORIES_ARCHITECTURE.md](./FAMILY_MEMORIES_ARCHITECTURE.md) | 平台架構 SSOT |
| [planner/10_PHASE_A_IMPLEMENTATION_PLAN.md](./planner/10_PHASE_A_IMPLEMENTATION_PLAN.md) | Phase A 實作計畫（wizard · MCP · 雄獅 adapter） |

### [Photo Sync Phase 3.5](./photo-sync/tier-policy/README.md)

### [Photo Sync Phase 3.5](./photo-sync/tier-policy/README.md)

iCloud → Local 自動分層（osxphotos）。

| 文件 | 說明 |
| ------ | ------ |
| [10_REQUIREMENTS.md](./photo-sync/tier-policy/10_REQUIREMENTS.md) | PoC · tier-policy.sh · 驗收 |

Phase 3 已歸檔 → [60_completed/phase3-photo-sync-bulk/](../60_completed/phase3-photo-sync-bulk/)

### [Similar images（Optional）](./photo-sync/similar-images/README.md)

驗證 Immich Duplicate Detection 是否足夠；不足則自建 audit CLI。

| 文件 | 說明 |
| ------ | ------ |
| [10_REQUIREMENTS.md](./photo-sync/similar-images/10_REQUIREMENTS.md) | 三層 dedupe · 驗收標準 |
| [SIMILAR_IMAGES_EVAL.md](../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md) | 驗證 runbook |

### [Photo Edit + AI（Optional）](./photo-edit/README.md)

AI 修圖與 Immich 整合（Sidecar BFF · ComfyUI）。

| 文件 | 說明 |
| ------ | ------ |
| [10_REQUIREMENTS.md](./photo-edit/10_REQUIREMENTS.md) | 三階段方案 · 驗收 |

---

## 維運指南（非 planning）

→ [20_guides/](../20_guides/)

| 目錄 | 內容 |
| ------ | ------ |
| [infra/](../20_guides/infra/) | K8s、Tekton、GPU、升級 checklist |
| [photo-sync/](../20_guides/photo-sync/) | 儲存 / cleanup runbooks |
| [COMMAND_REFERENCE.md](../20_guides/COMMAND_REFERENCE.md) | make / CLI 指令 |

---

## 已結案

→ [60_completed/README.md](../60_completed/README.md)

| 專案 | 歸檔 |
| ------ | ------ |
| Phase 0 Repo | [phase0-repo-consolidation/](../60_completed/phase0-repo-consolidation/) |
| Phase 2 LINE Bot MVP（V1.1 defer） | [phase2-line-bot-mvp/](../60_completed/phase2-line-bot-mvp/) |
| Phase 3 Photo Sync | [phase3-photo-sync-bulk/](../60_completed/phase3-photo-sync-bulk/) |
| Phase 3.6 Delete Reconcile | [phase3-6-delete-reconcile/](../60_completed/phase3-6-delete-reconcile/) |
| Immich v2.7.5 | [immich-v2.7.5-upgrade/](../60_completed/immich-v2.7.5-upgrade/) |
