# Immich Apps 規劃文件導覽

> `docs/00_planning/` — **進行中專案需求** only

**最後更新**: 2026-06-13（Phase 2/3 結案 · infra/repo 移出 planning）

---

## SSOT

| 文件 | 用途 |
|------|------|
| [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md) | 任務 checklist SSOT |
| [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md) | 本週 Sprint |
| [BACKLOG.md](./BACKLOG.md) | 待辦優先序 |

---

## 進行中專案

### [LINE Bot V1.1](./line-bot/README.md)

MVP 已歸檔 → [60_completed/phase2-line-bot-mvp/](../60_completed/phase2-line-bot-mvp/)

| 文件 | 說明 |
|------|------|
| [10_REQUIREMENTS.md](./line-bot/10_REQUIREMENTS.md) | V1.1 需求 |

### [Photo Sync Phase 3.5](./photo-sync/tier-policy/README.md)

iCloud → Local 自動分層（osxphotos）。

| 文件 | 說明 |
|------|------|
| [10_REQUIREMENTS.md](./photo-sync/tier-policy/10_REQUIREMENTS.md) | PoC · tier-policy.sh · 驗收 |

Phase 3 已歸檔 → [60_completed/phase3-photo-sync-bulk/](../60_completed/phase3-photo-sync-bulk/)

### [Photo Edit + AI（Optional）](./photo-edit/README.md)

AI 修圖與 Immich 整合（Sidecar BFF · ComfyUI）。

| 文件 | 說明 |
|------|------|
| [10_REQUIREMENTS.md](./photo-edit/10_REQUIREMENTS.md) | 三階段方案 · 驗收 |

---

## 維運指南（非 planning）

→ [20_guides/](../20_guides/)

| 目錄 | 內容 |
|------|------|
| [infra/](../20_guides/infra/) | K8s、Tekton、GPU、升級 checklist |
| [photo-sync/](../20_guides/photo-sync/) | 儲存 / cleanup runbooks |
| [COMMAND_REFERENCE.md](../20_guides/COMMAND_REFERENCE.md) | make / CLI 指令 |

---

## 已結案

→ [60_completed/README.md](../60_completed/README.md)

| 專案 | 歸檔 |
|------|------|
| Phase 0 Repo | [phase0-repo-consolidation/](../60_completed/phase0-repo-consolidation/) |
| Phase 2 LINE Bot MVP | [phase2-line-bot-mvp/](../60_completed/phase2-line-bot-mvp/) |
| Phase 3 Photo Sync | [phase3-photo-sync-bulk/](../60_completed/phase3-photo-sync-bulk/) |
| Immich v2.7.5 | [immich-v2.7.5-upgrade/](../60_completed/immich-v2.7.5-upgrade/) |
