# Phase B — iCloud ismissing 下載策略

**狀態**: 🟢 download gate 達標（2026-06-15 16:21）· bulk 可開跑  
**前置**: Phase 3.5 M3 第一輪 local-path **1615/1615** 完成（2026-06-14）· Phase 3.6 reconcile/API upload ✅（PR #19）

---

## 背景

| 指標 | baseline（06-15 早） | 最新（06-15 15:14） | 說明 |
|------|---------------------|---------------------|------|
| cutoff 365d eligible | 4281 | 4281 | 一年前 cutoff |
| 已 export/import（M3 第一輪） | 1615 | 1615 | `state.json` 跳過 |
| eligible `ismissing` | **4119** | **34** | Phase B 完成條件 → **0** |
| 全庫 `ismissing` | ~4565 | **129** | 含 cutoff 後仍 cloud-only |
| `local_path` | ~160 | **4690** | originals 已落地 |
| `export_ready_now` | 1 | **4247** | 可進 bulk export |
| osxphotos export 進度 | — | **4270/4281** | `icloud-pull.log` |

**趨勢**：`WATCH=1` 監控約 6 小時，`eligible_ismissing` 4119→34；`tier-policy-download-missing.sh` 全量 eligible 接近跑完。

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

**完成條件（download）**：`eligible_ismissing` → **0 或 1**（實務上 **1 即可開 bulk**）；`export_ready_now` ≈ **4280**（新張 ~**2665** = 4280 − 1615）。

**Bulk gate**：`tier-policy-bulk-export.sh` 只 export `local_path` 項目；剩 1 張 ismissing 會被略過，不阻塞主流程。

**首次監控觀察（2026-06-15 早）**：全庫 `ismissing`↓、`local_path`↑，但 `eligible_ismissing` 一度持平——需 **Photos 依年份往回瀏覽** + `download-missing` 腳本並行。午後 `eligible_ismissing` 已降至 **34**。

### 2. Re-export + import（download 完成後主軌）

```bash
# cutoff 預設讀 config；也可用 --cutoff-days N / --cutoff-date YYYY-MM-DD
./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-days 365
IMPORT_MODE=auto ./scripts/photo-sync/tier-policy-bulk-import-staging.sh
./scripts/photo-sync/tier-policy-verify-staging.sh
./scripts/photo-sync/tier-policy-delete-source.sh --yes --skip-gui
# → Photos：TierPolicy-Delete 相簿 → ⌘A → ⌘Delete → 確認
```

`state.json` 的 `exported_uuids` / `imported_uuids` 會跳過已完成 UUID（1615）。

**建議順序**（與 M3 第一輪相同，規模更大 ~2666 張）：

1. **Gate**：`eligible_ismissing` ≤ 1 · `export_ready_now` ≈ 4280（**不必等 0**）
2. **Export**：`tier-policy-bulk-export.sh --cutoff-days 365`（可隔夜；staging 需磁碟）
3. **Import**：`IMPORT_MODE=auto` 或 `manual` + `tier-policy-bulk-import-staging.sh`
4. **Verify**：`tier-policy-verify-staging.sh`；失敗 → `tier-policy-retry-failed-import.sh`
5. **Delete source**：`tier-policy-delete-source.sh` → GUI 刪 icloud → Recently Deleted
6. **Immich**：`immich-sync.sh --dry-run` → **0 new**（`upload_mode: api` 帶 Photos 日期）
7. **iCloud 配額**：Recently Deleted → **全部删除**（第一輪 1615 + 本輪合計）

**與 immich-watch 錯峰**：bulk export 期間可暫停 `com.immich.photo-sync.watch`（避免 sync storm）。

### 3. Immich 驗收

```bash
./scripts/photo-sync/immich-sync.sh --dry-run
# 預期：兩 library 0 new
```

### 4. Phase B 收尾 checklist

| # | 項目 | 指令 / 備註 |
|---|------|-------------|
| A | 確認 download 完成 | `eligible_ismissing: 0`；`icloud-pull.log` 無 error |
| B | bulk export/import/verify | 見 §2 |
| C | 刪 icloud source + 清 Recently Deleted | 釋放 iCloud 配額 |
| D | immich-sync 0 new | API upload 預設已開 |
| E | 可選：immich-reconcile dry-run | 週日 LaunchAgent 已裝；apply 僅在確認 orphan 後 |
| F | 更新 PROGRESS_TRACKING §3.5.3 | Phase B ✅ |

**Phase 3.5 全完成後**：tier 搬移結束；icloud 僅留 cutoff 後新照；local-archive + Immich union 不變。

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
