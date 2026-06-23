# Mac Photos Library 原始檔備份策略

**最後更新**：2026-06-23

---

## 釐清：目前 Phase 5a 備了什麼？

| CronJob | 範圍 | 是否「原始檔」 |
|---------|------|----------------|
| `immich-pg-backup` | PostgreSQL dump | ❌ 僅 metadata／索引 |
| `immich-data-backup` | Immich PVC **`/data/upload`** | ✅ **Immich 內的原圖**（photo-sync + LINE 上傳後的檔案） |

**未直接備份**：Mac Studio 上的 `.photoslibrary` 目錄（`local-archive`、`icloud-primary` 的 **Photos 原始容器**）。

Photo-sync 已把兩庫內容 **上傳至 Immich**（5023 + 3512），因此 B2 週備份 `/data/upload` **涵蓋已 sync 的原圖**，但：

- Photos 內 **尚未 sync** 的新檔不在 B2
- `.photoslibrary` 結構、sidecar、部分 Apple 衍生檔 **不在** Immich upload
- iCloud 僅雲端、本機無原檔時，**唯一完整副本可能在 Immich**

---

## 你的問題：Mac library → delta NFS？

**可以**，且對「我要原始檔」是合理 **第二層本機冷備**。

| 方案 | 優點 | 缺點 |
|------|------|------|
| **Mac → delta NFS**（rsync `originals/` 或整庫） | 大檔走內網、速度快、可還原 Photos 結構 | 與 lama **同機房**；delta 故障 = 副本失效 |
| **Immich → B2**（現有 CronJob） | 異地 3-2-1、與服務一致 | 僅 Immich 已 ingest 的檔案 |
| **僅 pg_dump** | 小、快 | **不含**照片位元組 |

### 建議（3-2-1）

```text
Mac Studio (.photoslibrary originals)
    ├─[rsync 每週]─→ delta NFS  /mnt/.../photos-backup/mac-studio/
    └─[immich-sync]─→ Immich /data/upload ─[週日]─→ B2
PostgreSQL ─[每日]─→ PVC + B2
```

1. **保留** Phase 5a：`/data/upload` + pg → B2（異地）。
2. **新增** Mac → delta：**只 sync `originals/`**（或 `photoslibrary` 唯讀掛載後 rsync），不要與 tier-policy 搬移衝突時段。
3. **不要**用 NFS 取代 B2（火災／勒索軟體／單點機房風險仍在）。
4. **排程**：Mac rsync 與 `immich-data-backup`（週日 04:00）錯開；tier bulk 執行日跳過。

### 範例 rsync（草稿，未自動化）

```bash
# local-archive originals（路徑依 config）
SRC="$HOME/Pictures/LOCAL PHOTO LIBRARY.photoslibrary/originals"
DST="delta.3q.fi:/mnt/data/nfs/photos-backup/mac-studio/local-archive/"

rsync -avh --delete --partial \
  --exclude='.DS_Store' \
  "$SRC/" "rsync://..."   # 或 ssh + delta 路徑
```

icloud-primary 同理；**先 dry-run**（`--dry-run -i`）。

---

## 與 Immich Enhancement 的關係

| 資料 | SSOT |
|------|------|
| 日常瀏覽／搜尋 | Immich |
| Mac Photos 編輯／相簿 | Photos.app |
| 異地災備 | B2 |
| 大容量本機冷備 | delta NFS（建議） |

此 Mac→NFS 流程 **不在** Phase 5a gate 內；可列 Phase 5a+ 或維運 runbook，由 infra-bootstrap `delta` NFS export 權限與配額決定。

---

## 相關

- [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)
- [B2_BACKBLAZE_SETUP.md](./B2_BACKBLAZE_SETUP.md)
- `scripts/photo-sync/README.md`
