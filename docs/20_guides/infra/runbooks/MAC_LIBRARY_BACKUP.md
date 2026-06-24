# Mac Photos Library 原始檔備份策略

**最後更新**：2026-06-24

---

## 排程建議（2026-06-24）

| 項目 | 建議 |
| ------ | ------ |
| **Phase 4 SSD** | ✅ **COMPLETE**（postgres → `/nvme/immich-postgres`） |
| **Ops W2 Mac → delta NFS** | **prep 進行中** · 完整 rsync **Q3** |
| **首輪 Mac rsync** | 一輪 pg/NFS 備份驗證後（週日 04:00 data-backup 後評估） |

### Delta NFS 目標路徑（SSOT）

| 項目 | 值 |
| ------ | ------ |
| Host | `delta.3q.fi`（192.168.50.110） |
| Export（NVMe） | `/home/nfs-storage`（`nfs-client` StorageClass） |
| Mac 備份根 | `/home/nfs-storage/photos-backup/mac-studio/` |
| Prep 腳本 | `scripts/mac-library-backup-dry-run.sh`（`rsync -n`） |

```bash
# prep：僅 dry-run，不寫入
bash scripts/mac-library-backup-dry-run.sh
```

---

## 釐清：目前 Phase 5a 備了什麼？

| CronJob | 範圍 | 是否「原始檔」 |
| --------- | ------ | ---------------- |
| `immich-pg-backup` | PostgreSQL dump | ❌ 僅 metadata／索引 |
| `immich-data-backup` | Immich `/data/upload` → NFS | ✅ Immich 內原圖 |

**未直接備份**：Mac Studio 上的 `.photoslibrary` 目錄（`local-archive`、`icloud-primary` 的 **Photos 原始容器**）。

Photo-sync 已把兩庫內容 **上傳至 Immich**（5023 + 3512），因此 NFS 週備份 `/data/upload` **涵蓋已 sync 的原圖**，但：

- Photos 內 **尚未 sync** 的新檔不在 NFS 備份
- `.photoslibrary` 結構、sidecar、部分 Apple 衍生檔 **不在** Immich upload
- iCloud 僅雲端、本機無原檔時，**唯一完整副本可能在 Immich**

---

## 你的問題：Mac library → delta NFS？

**可以**，且對「我要原始檔」是合理 **第二層本機冷備**。

| 方案 | 優點 | 缺點 |
| ------ | ------ | ------ |
| **Mac → delta NFS**（rsync `originals/` 或整庫） | 大檔走內網、速度快、可還原 Photos 結構 | 與 lama **同機房**；delta 故障 = 副本失效 |
| **Immich → NFS 週備份** | 內網第二副本、與服務一致 | 僅 Immich 已 ingest 的檔案 |
| **僅 pg_dump** | 小、快 | **不含**照片位元組 |

### 建議（3-2-1）

```text
Mac Studio (.photoslibrary originals)
    ├─[rsync 每週]─→ delta NFS  /mnt/.../photos-backup/mac-studio/
    └─[immich-sync]─→ Immich /data/upload ─[週日]─→ NFS HDD
PostgreSQL ─[每日]─→ PVC + NFS
```

1. **保留** Phase 5a：`/data/upload` + pg → NFS（內網副本）。
2. **新增** Mac → delta：**只 sync `originals/`**（或 `photoslibrary` 唯讀掛載後 rsync），不要與 tier-policy 搬移衝突時段。
3. **可選**第三副本（如 Google Drive）作異地災備；NFS 不取代異地備份策略。
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
| ------ | ------ |
| 日常瀏覽／搜尋 | Immich |
| Mac Photos 編輯／相簿 | Photos.app |
| 內網冷備 | delta NFS |
| 大容量本機冷備 | delta NFS（建議） |

此 Mac→NFS 流程 **不在** Phase 5a gate 內；可列 Phase 5a+ 或維運 runbook，由 infra-bootstrap `delta` NFS export 權限與配額決定。

---

## 相關

- [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)
- `scripts/mac-library-backup-dry-run.sh`
- `scripts/photo-sync/README.md`
