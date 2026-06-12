# Phase 3.5 — iCloud 分層（tier policy）

**狀態**: 🟢 Kickoff（2026-06-13）  
**優先級**: P1（P0 驗收後主軌）  
**SSOT**: [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) · [PROGRESS_TRACKING §3.5](../../PROGRESS_TRACKING.md)

## 問題

iCloud 空間有限；舊照片應從 `icloud-primary` 移到 `local-archive`，兩邊仍 sync 至 Immich（hash dedupe）。

## 文件

| 文件 | 用途 |
|------|------|
| [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) | 需求、PoC、驗收 |
| [20_CROSS_LIBRARY_MOVE_RESEARCH.md](./20_CROSS_LIBRARY_MOVE_RESEARCH.md) | M2 跨 library 研究 |
| [Phase 3 歸檔](../../../60_completed/phase3-photo-sync-bulk/10_REQUIREMENTS.md) | 背景 §iCloud 分層 |

## 設定

`scripts/photo-sync/photo-sync.config.yaml.example` → `tier_policy`（目前 `enabled: false`）
