# Phase 3.5 — iCloud 分層（tier policy）

**狀態**: 🟡 M3 第一輪完成（2026-06-14）  
**優先級**: P1（P0 驗收後主軌）  
**SSOT**: [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) · [PROGRESS_TRACKING §3.5](../../PROGRESS_TRACKING.md)

## 進度摘要（2026-06-14）

| 階段 | 狀態 |
|------|------|
| M1 PoC + spot-check | ✅ 577 local eligible 100% Immich dup |
| M2 跨 library 研究 | ✅ export→import 可行 |
| M3 bulk export | ✅ **1615** 張（cutoff 一年前 · local-path） |
| M3 bulk import + verify | ✅ **1615 / 1615** |
| 人工刪 source | ✅ 1615 → Recently Deleted |
| 永久清除 Recently Deleted | ⏳ 釋放 iCloud 配額 |
| Phase B（4119 ismissing） | 📋 需 iCloud 下載策略 |

## 問題

iCloud 空間有限；舊照片應從 `icloud-primary` 移到 `local-archive`，兩邊仍 sync 至 Immich（hash dedupe）。

## 文件

| 文件 | 用途 |
|------|------|
| [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) | 需求、PoC、驗收 |
| [20_CROSS_LIBRARY_MOVE_RESEARCH.md](./20_CROSS_LIBRARY_MOVE_RESEARCH.md) | M2 跨 library 研究 |
| [30_PHASE_B_ICLOUD_DOWNLOAD.md](./30_PHASE_B_ICLOUD_DOWNLOAD.md) | Phase B ismissing 下載 |
| [Phase 3 歸檔](../../../60_completed/phase3-photo-sync-bulk/10_REQUIREMENTS.md) | 背景 §iCloud 分層 |

## 設定

`scripts/photo-sync/photo-sync.config.yaml.example` → `tier_policy`（目前 `enabled: false`）
