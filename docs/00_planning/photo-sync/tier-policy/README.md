# Phase 3.5 — iCloud 分層（tier policy）

**狀態**: 🟢 bulk 可開跑（2026-06-15）  
**優先級**: P1 主軌 · P0 E2E 並行  
**SSOT**: [10_REQUIREMENTS.md](./10_REQUIREMENTS.md) · [PROGRESS_TRACKING §3.5](../../PROGRESS_TRACKING.md)

## 進度摘要（2026-06-15）

| 階段 | 狀態 |
|------|------|
| M1 PoC + spot-check | ✅ 577 local eligible 100% Immich dup |
| M2 跨 library 研究 | ✅ export→import 可行 |
| M3 bulk export（第一輪） | ✅ **1615** 張（cutoff 一年前 · local-path） |
| M3 bulk import + verify | ✅ **1615 / 1615** |
| 人工刪 source（第一輪） | ✅ 1615 → Recently Deleted |
| Phase 3.6 reconcile + API upload | ✅ PR #19 · orphan 484 trashed · date fix |
| Phase B download originals | ✅ **4280/4281** · `eligible_ismissing` **1** |
| Phase B bulk export/import | 🟡 export ✅ **75 batch** · import 進行中 |
| 永久清除 Recently Deleted | ⏳ 兩輪 delete 後一次清 |

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

### 永久清除 Recently Deleted（釋放 iCloud）

macOS **沒有**獨立的「設定 → 永久清除」開關；需從 **最近刪除** 相簿操作：

1. Photos 開啟 **icloud-primary**
2. 左側 **最近刪除**（Recently Deleted）
3. 右上角 **全部删除** / Delete All → 確認

或選單：**照片** → **清除已删除的项目…** / Erase Deleted Items…（macOS 英文版）

清除後 iCloud 配額才會釋放（刪除後預設仍保留 30 天）。
