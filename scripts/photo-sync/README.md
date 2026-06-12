# Mac Photo Sync → Immich

Phase 3 本機同步。Mac `.photoslibrary` = SSOT；Immich = union 備份 + hash dedupe。

## 快速開始

```bash
cd immich-apps

# 1. 憑證（擇一）
./scripts/photo-sync/bootstrap-credentials.sh          # 推薦；寫入 ~/.config/immich-apps/photo-sync.env
# eval "$(./scripts/dev/load-env-from-op.sh)"          # 或每次手動

# 勿在 .env 設 IMMICH_API_KEY=your-... — direnv 會覆蓋 1Password

# 2. 設定檔
cp scripts/photo-sync/photo-sync.config.yaml.example ~/.config/immich-apps/photo-sync.config.yaml

# 3. 同步
./scripts/photo-sync/test-upload.sh                    # 煙霧測試
./scripts/photo-sync/immich-sync.sh --library local-archive
./scripts/photo-sync/immich-sync.sh --library icloud-primary   # local 完成後

# 4. 背景監控（可選）
./scripts/photo-sync/install-launchd.sh
```

## 續傳

中斷後 **重跑同一指令**；CLI hash skip 已上傳檔案。失敗檔案會自動以 `retry_concurrency: 1` 重試；502/503 等 transient 錯誤會整批重跑（最多 `max_retries` 次）。

同步統計（`sync.json_output: true`）寫入 `~/Library/Logs/immich-photo-sync/stats/*.json`（`new_files` / `duplicates` / `new_assets` / `failed_assets`）。失敗路徑另存 `stats/*-failed-*.txt`；完整 CLI 輸出在 `stats/*-run-*.log`。

### 監控進度

```bash
# 結構化摘要（最新一筆）
ls -t ~/Library/Logs/immich-photo-sync/stats/local-archive-*.json | head -1 | xargs cat

# 即時 CLI 輸出（含 Uploading assets 進度列）
tail -f ~/Library/Logs/immich-photo-sync/stats/local-archive-run-*.log

# 腳本時間戳記
tail -f ~/Library/Logs/immich-photo-sync/sync.log
```

**進度列**：`immich-sync.sh` 以 pseudo-TTY 轉發 CLI 輸出，terminal 應能看到 `Uploading assets | …` 動態列。若仍無動態列，用 `tail -f stats/*-run-*.log` 觀察（舊版 pipe 轉發會把 `\r` 進度列緩衝到換行才顯示）。

觀察 Immich 背景 metadata / 人臉 / Smart Search：

```bash
./scripts/photo-sync/observe-asset-intelligence.sh --tag line-import
./scripts/photo-sync/observe-asset-intelligence.sh --smart "beach sunset"
```

## 多 Library

| ID | 路徑 | Album | 狀態 |
|----|------|-------|------|
| `local-archive` | `LOCAL PHOTO LIBRARY.photoslibrary/originals` | Mac Photos (Local Archive) | ✅ 5023/5023 |
| `icloud-primary` | `Photos Library.photoslibrary/originals` | Mac Photos (iCloud) | ✅ 3512/3512 |

## 憑證

| 方式 | 用途 |
|------|------|
| `photo-sync.env` | LaunchAgent / 減少 1Password 彈窗 |
| `load-env-from-op.sh` | 手動 dev |
| `ensure-immich-creds.sh` | 腳本內部；略過 `.env` placeholder |

## 儲存盤點

Immich 磁碟組成與 duplicate 分析（2026-06-12 更新）→ [docs/PHASE3_STORAGE_AUDIT.md](../../docs/PHASE3_STORAGE_AUDIT.md)

Local library hash / 時間戳抽查：

```bash
./scripts/photo-sync/audit-local-duplicates.py
# 報告：~/Library/Logs/immich-photo-sync/audit-local-duplicates.json
```

## iCloud 分層（Phase 3.5）

`tier_policy` 規劃中；需 osxphotos。目前手動搬移 + 兩 library 都 sync。

## 備份

Mac SSOT → Immich upload → Phase 5 B2（見 `docs/PHASE5_BACKUP_MONITORING.md`）。
