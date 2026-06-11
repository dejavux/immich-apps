# Mac Photo Sync → Immich

Phase 3 本機同步工具。Mac 上 `.photoslibrary` 為 SSOT；Immich 為 union 備份 + dedupe。

## 快速開始

```bash
# 0. 憑證
cd immich-apps
eval "$(./scripts/dev/load-env-from-op.sh)"
export IMMICH_INSTANCE_URL="${IMMICH_BASE_URL:-https://immich.3q.fi}"

# 1. CLI 煙霧測試（必做）
./scripts/photo-sync/test-upload.sh

# 2. 設定檔
mkdir -p ~/.config/immich-apps
cp scripts/photo-sync/photo-sync.config.yaml.example ~/.config/immich-apps/photo-sync.config.yaml
# 編輯 libraries[].path 對應本機兩個 .photoslibrary

# 3. 依賴
brew install fswatch   # watch 用
# immich CLI: npm install -g @immich/cli  （本機已有 2.2.61）

# 4. 手動全量同步
chmod +x scripts/photo-sync/*.sh
./scripts/photo-sync/immich-sync.sh

# 5. 背景監控（可選，LaunchAgent 見 docs/PHASE3_PHOTO_SYNC.md）
./scripts/photo-sync/immich-watch.sh
```

## 多 Library

預設範例含兩個 library：

| ID | 路徑 | Immich Album |
|----|------|--------------|
| `icloud-primary` | `Photos Library.photoslibrary/originals` | Mac Photos (iCloud) |
| `local-archive` | `LOCAL PHOTO LIBRARY.photoslibrary/originals` | Mac Photos (Local Archive) |

Immich CLI 依檔案 hash dedupe，兩邊重複檔只存一份。

## iCloud 分層（Phase 3.5）

`tier_policy` 區塊為**規劃中**：自動把 iCloud library 超量／過舊照片移到 local library 需 **osxphotos** 或 Photos AppleScript，尚未實作。目前請手動在 Photos App 搬移，sync 腳本會兩邊都上傳到 Immich。

## 備份

Mac `.photoslibrary` = 來源 SSOT；Immich server = 第 1 份集中備份；Phase 5 B2 = 異地第 2 份（見 `docs/PHASE5_BACKUP_MONITORING.md`）。
