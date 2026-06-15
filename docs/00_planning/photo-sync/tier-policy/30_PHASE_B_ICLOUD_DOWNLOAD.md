# Phase B — iCloud ismissing 下載策略

**狀態**: 🟡 下載進行中（2026-06-15）  
**前置**: Phase 3.5 M3 第一輪 local-path **1615/1615** 完成（2026-06-14）

---

## 背景

| 指標 | 數值（2026-06-15 baseline） |
|------|------|
| cutoff 365d eligible | **4281** |
| 已 export/import（local-path） | **1615** ✅ |
| eligible `ismissing` 待下載 | **4119** |
| icloud-primary 現役 | **4818** |
| export_ready_now | **1**（其餘 1615 已在 state 跳過） |

---

## 步驟

### 1. 強制 iCloud 原尺寸下載（osxphotos · 推薦）

**Apple 沒有「全部下載」按鈕**；勾選設定後仍需 **export / 瀏覽** 才會拉舊照。

#### 1a. 前置

1. **照片 → 設定 → 「將此 Mac 上的照片和影片下載原尺寸」**
2. 系統設定 → Apple ID → iCloud → 照片 → **不要**「最佳化 Mac 儲存空間」
3. **磁碟**：eligible ismissing ≈ **4100 張 / ~71 GB**（2026-06-15 估算）；不足則 **分年** 下載
4. **Terminal 需 Photos 權限**：系統設定 → 隱私權與安全性 → 照片 → 允許 **Terminal / iTerm**

#### 1b. 腳本（Phase B 包裝）

```bash
export PATH="$HOME/.local/bin:$PATH"
cd immich-apps

# 預覽（不寫檔）
./scripts/photo-sync/tier-policy-download-missing.sh --dry-run --cutoff-days 365

# 全量 eligible（需 ~71GB 可用空間）
MIN_FREE_GB=60 ./scripts/photo-sync/tier-policy-download-missing.sh --cutoff-days 365

# 磁碟不足時：分年（例）
MIN_FREE_GB=5  ./scripts/photo-sync/tier-policy-download-missing.sh --from-date 2020-01-01 --to-date 2020-12-31
MIN_FREE_GB=12 ./scripts/photo-sync/tier-policy-download-missing.sh --from-date 2022-01-01 --to-date 2022-12-31
MIN_FREE_GB=15 ./scripts/photo-sync/tier-policy-download-missing.sh --from-date 2024-01-01 --to-date 2024-12-31
MIN_FREE_GB=45 ./scripts/photo-sync/tier-policy-download-missing.sh --from-date 2023-01-01 --to-date 2023-12-31
```

Log：`~/Library/Logs/immich-photo-sync/tier/icloud-pull.log`  
底層：`osxphotos export … --download-missing --use-photokit`

#### 1c. GUI 輔助（可並行）

Photos 開 icloud-primary → **年/月** 檢視 → 從 cutoff 前年份往回滾動。

### 1d. 監控 ismissing 下降 🟡

```bash
export PATH="$HOME/.local/bin:$PATH"
# 單次 snapshot
./scripts/photo-sync/tier-policy-monitor-ismissing.sh --cutoff-days 365

# 每 5 分鐘寫入 log（Phase B 長跑）
WATCH=1 INTERVAL=300 ./scripts/photo-sync/tier-policy-monitor-ismissing.sh --cutoff-days 365
# log: ~/Library/Logs/immich-photo-sync/tier/ismissing-monitor.log

# 影片 subset（可選）
./scripts/photo-sync/audit-icloud-videos.sh
```

**完成條件**：`eligible_ismissing` → **0**，且 `export_ready_now` 穩定上升。

**首次監控觀察（2026-06-15）**：全庫 `ismissing`↓、`local_path`↑，但 `eligible_ismissing` 仍 **4119** 不變——表示 iCloud 有在下載，但 **cutoff 前的舊照片** 可能尚未觸發。建議在 Photos **依年份往回瀏覽**（2025-06 以前），並保持 App 開啟；log 見 `ismissing-monitor.log`。

### 2. Re-export + import

下載完成後：

```bash
# cutoff 預設讀 config；也可用 --cutoff-days N / --cutoff-date YYYY-MM-DD
./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-days 365
IMPORT_MODE=auto ./scripts/photo-sync/tier-policy-bulk-import-staging.sh
./scripts/photo-sync/tier-policy-verify-staging.sh
./scripts/photo-sync/tier-policy-delete-source.sh --yes --skip-gui
# → Photos：TierPolicy-Delete 相簿 → ⌘A → ⌘Delete → 確認
```

`state.json` 的 `exported_uuids` / `imported_uuids` 會跳過已完成 UUID。

### 3. Immich 驗收

```bash
./scripts/photo-sync/immich-sync.sh --dry-run
# 預期：兩 library 0 new
```

---

## 風險

| 風險 | 緩解 |
|------|------|
| 磁碟空間不足（4119 原檔） | 先估算 eligible 體積；必要時外接碟暫存 library |
| iCloud 下載慢 / 中斷 | 分批依年份下載；`audit_icloud_videos.py` 追蹤進度 |
| sync storm | tier export 與 `immich-watch` 錯開 |

---

## 相關腳本

- `scripts/photo-sync/tier-policy-download-missing.sh` — osxphotos 強制下載（Phase B）
- `scripts/photo-sync/tier-policy-monitor-ismissing.sh` — Phase B 進度 snapshot / watch
- `scripts/photo-sync/audit-icloud-videos.sh` — video DB/disk/Immich 報告
- `scripts/photo-sync/tier-policy-bulk-export.sh` — 預設用 config cutoff；可 `--cutoff-days N`
- `scripts/photo-sync/tier-policy-verify-staging.sh`
