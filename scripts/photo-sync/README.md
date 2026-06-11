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

中斷後 **重跑同一指令**；CLI hash skip 已上傳檔案。

## 多 Library

| ID | 路徑 | Album | 狀態 |
|----|------|-------|------|
| `local-archive` | `LOCAL PHOTO LIBRARY.photoslibrary/originals` | Mac Photos (Local Archive) | 🚧 全量上傳中 |
| `icloud-primary` | `Photos Library.photoslibrary/originals` | Mac Photos (iCloud) | ⏳ 待 local 完成 |

## 憑證

| 方式 | 用途 |
|------|------|
| `photo-sync.env` | LaunchAgent / 減少 1Password 彈窗 |
| `load-env-from-op.sh` | 手動 dev |
| `ensure-immich-creds.sh` | 腳本內部；略過 `.env` placeholder |

## 儲存盤點

Immich ~112 GB 磁碟組成與 duplicate 分析 → [docs/PHASE3_STORAGE_AUDIT.md](../../docs/PHASE3_STORAGE_AUDIT.md)

## iCloud 分層（Phase 3.5）

`tier_policy` 規劃中；需 osxphotos。目前手動搬移 + 兩 library 都 sync。

## 備份

Mac SSOT → Immich upload → Phase 5 B2（見 `docs/PHASE5_BACKUP_MONITORING.md`）。
