# Tier Policy Runbook — icloud-primary → local-archive

**Phase 3.5 M3** · 最後更新：2026-06-14

---

## 前置

```bash
pip3 install --user osxphotos photoscript
export PATH="$HOME/.local/bin:$PATH"
```

設定檔 `~/.config/immich-apps/photo-sync.config.yaml`：

```yaml
tier_policy:
  enabled: true          # --execute 必要
  dry_run: true          # 預設只規劃；execute 時加 --execute
  cutoff_date: "2023-01-01"
  batch_size: 10
  local_path_only: true
  skip_shared_library: false
```

---

## 流程

### 1. 規劃（dry-run）

```bash
./scripts/photo-sync/tier-policy-poc.sh
./scripts/photo-sync/tier-policy-spotcheck.sh
./scripts/photo-sync/tier-policy.sh --dry-run --batch-size 10
```

報告：`~/Library/Logs/immich-photo-sync/tier/tier-plan-*.json`

### 2. 執行一批（建議：export 與 import 分開）

**Apple 限制**：寫入 Photos library **必須**經 Photos.app；無法完全 headless。
**可靠做法**：先 export，再 **manual import** + verify poll。

#### 2a. 只 export（不需 Photos 互動）

```bash
./scripts/photo-sync/tier-policy.sh --execute --export-only --force --batch-size 1
# → staging/batch-*/batch-manifest.json
```

#### 2b. import staging（推薦 `--import-mode manual`）

```bash
# 開 Photos LOCAL library + Finder，你在 GUI 做 File → Import
./scripts/photo-sync/tier-policy-import-staging.sh \
  /tmp/immich-photo-sync/tier-staging/batch-YYYYMMDD-HHMMSS \
  --import-mode manual --verify-timeout 300

# 或嘗試自動（可能卡在 Photos modal）
./scripts/photo-sync/tier-policy-import-staging.sh /path/to/batch --import-mode auto
```

腳本會 **poll verify**（最多 `--verify-timeout` 秒），以 target library 是否出現檔案為準——
不再相信 `osxphotos import` 的 exit code alone。

#### 2c. 一次跑 export+import（舊行為）

```bash
./scripts/photo-sync/tier-policy.sh --execute --force --batch-size 1 \
  --import-mode manual --verify-timeout 300
```

### 3. 人工刪除 source（gate）

manifest：`~/Library/Logs/immich-photo-sync/tier/tier-delete-manifest-*.json`

**自動化（2026-06-14 實測）**：

```bash
# 1. 建立相簿 TierPolicy-Delete（1615 張）
./scripts/photo-sync/tier-policy-delete-source.sh --yes --skip-gui

# 2. Photos 開啟 icloud-primary → 點相簿 → ⌘A → ⌘Delete → 確認
#    或腳本 GUI 模式（需 Terminal 輔助使用權限）：
./scripts/photo-sync/tier-policy-delete-source.sh --yes

# 3. 驗證（1615 張應在 Recently Deleted）
python3 -c "import osxphotos; db=osxphotos.PhotosDB('~/Pictures/Photos Library.photoslibrary'); ..."
```

**釋放 iCloud 空間**（無「設定裡永久清除」選項）：

1. Photos 左側 **最近刪除** / Recently Deleted
2. 右上角 **全部删除** / Delete All → 確認

或選單：**照片** → **清除已删除的项目…** / Erase Deleted Items…

手動步驟（舊）：

1. 在 Photos 開啟 **icloud-primary**
2. **刪除**（Immich 仍有備份；local-archive 已 import）
3. `shared_library: true` 項目需特別確認是否適合刪除

腳本會在 terminal 暫停等待 Enter（`--no-pause` 可略過）。

### 4. 重複直到搬完

狀態檔：`~/Library/Logs/immich-photo-sync/tier/state.json`（已 import 的 UUID 會跳過）

```bash
# 577 張 local-path ≈ 58 批 × batch_size 10
while ./scripts/photo-sync/tier-policy.sh --execute --batch-size 10 --no-pause; do
  sleep 5
done
```

### 5. 驗收

```bash
./scripts/photo-sync/tier-policy-verify-staging.sh
# → 1615/1615 verified · report: ~/Library/Logs/immich-photo-sync/tier/tier-verify-staging.json
./scripts/photo-sync/immich-sync.sh --dry-run
./scripts/photo-sync/tier-policy-spotcheck.sh
```

### 6. 重試失敗 batch

```bash
./scripts/photo-sync/tier-policy-verify-staging.sh   # 產生 tier-verify-staging.json
IMPORT_MODE=auto ./scripts/photo-sync/tier-policy-retry-failed-import.sh
```

---

## Bulk 流程（已實測 2026-06-14）

```bash
# cutoff：預設 config tier_policy.cutoff_date；或 CLI 覆寫
./scripts/photo-sync/tier-policy-bulk-export.sh                    # config 預設
./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-days 365  # 推薦：任意天數
./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-date 2023-01-01
./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-one-year  # = --cutoff-days 365

# Phase B 監控 / 下載
WATCH=1 INTERVAL=300 ./scripts/photo-sync/tier-policy-monitor-ismissing.sh --cutoff-days 365
# Gate: eligible_ismissing → 0 後才 bulk export

MIN_FREE_GB=60 ./scripts/photo-sync/tier-policy-download-missing.sh --cutoff-days 365
# log: ~/Library/Logs/immich-photo-sync/tier/icloud-pull.log

# Phase B bulk（download 完成後 · ~2666 新張）
./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-days 365
IMPORT_MODE=auto ./scripts/photo-sync/tier-policy-bulk-import-staging.sh
./scripts/photo-sync/tier-policy-verify-staging.sh
./scripts/photo-sync/tier-policy-delete-source.sh --yes --skip-gui
./scripts/photo-sync/immich-sync.sh --dry-run   # 預期 0 new

# 2. import 全部 staging batch
IMPORT_MODE=auto ./scripts/photo-sync/tier-policy-bulk-import-staging.sh

# 3. 若有 gap → retry
./scripts/photo-sync/tier-policy-retry-failed-import.sh

# 4. 驗證
./scripts/photo-sync/tier-policy-verify-staging.sh
```

---

## Rollback（手動）

1. 在 **local-archive** 找到 import 項目
2. Export 或拖回 **icloud-primary**（Photos UI）
3. 從 `tier/state.json` 移除對應 UUID（若需 re-run tier）

---

## 疑難排解

| 問題 | 處理 |
|------|------|
| `tier_policy.enabled is false` | config 設 `enabled: true` 或 `--force` |
| import hang 在 0% | 改 `--import-mode manual`；Photos 前台 File → Import |
| import 顯示成功但 verify 失敗 | 常見：Photos 被 killall / 寫錯 library；用 import-staging 重試 |
| Live Photo Unknown error | **只 import HEIC/JPEG**；`.mov` 留同資料夾。auto 模式已自動略過 companion `.mov` |
| osxphotos import 假成功 | 以 verify poll 為準；見 `tier-policy-import-staging.sh` |
| export 含 `_edited` 變體 | verify 以 `filename:fingerprint` 為準；原檔與 edited 為不同項目 |
| export 空目錄 | 項目可能 `ismissing`；v1 只處理 local path |
| Automation 權限 | 系統設定 → 隱私權 → 自動化 → Terminal 勾 Photos |

---

## 參考

- [10_REQUIREMENTS.md](../../00_planning/photo-sync/tier-policy/10_REQUIREMENTS.md)
- [20_CROSS_LIBRARY_MOVE_RESEARCH.md](../../00_planning/photo-sync/tier-policy/20_CROSS_LIBRARY_MOVE_RESEARCH.md)
