# Phase 3：Immich 伺服器儲存盤點

**日期**: 2026-06-11  
**節點**: `lama` · namespace `immich` · PVC `/data`

---

## 摘要

使用者觀察 Immich 約 **~100GB** 磁碟占用，懷疑曾重複上傳兩份 Photos Library。  
盤點結果：**不是 DB 內有兩份完整 library**，而是 **多種儲存用途疊加**；**LOCAL archive 與 Immich DB assets hash 不重疊**（CLI 5023 new / 0 dup），但 **磁碟上另有 ~43GB external-library 舊副本**（未 index 進 library）。

---

## 磁碟配置（2026-06-11）

| 路徑 | 大小 | 檔案數（約） | 說明 |
|------|------|-------------|------|
| `/data/upload` | **44 GB** ↑ | ~5163+ | Immich **正式 library** 原檔（App/CLI 上傳） |
| `/external-library` | **43 GB** | 7832 | hostPath 舊 rsync 目錄 |
| `/data/external-library` | **43 GB** | 7832 | PVC 內同內容副本 |
| `/data/encoded-video` | **23 GB** | — | 影片轉檔（非原檔 duplicate） |
| `/data/thumbs` | **2 GB** | — | 縮圖 |

**合計** ~112 GB（含轉檔 + 縮圖）。

---

## Immich DB（API `server-info`）

| 指標 | 上傳前 | 上傳中（2026-06-11 晚） |
|------|--------|-------------------------|
| Images | ~2731 | ~2789 |
| Videos | ~412 | ~419 |
| **Total** | **~3143** | **~3208** |

External library **「Migrated photos」**：`assetCount: 0`（磁碟有檔、DB 未 index）。

---

## Mac vs Immich 比對

| 來源 | originals 檔案數 | 大小 |
|------|-----------------|------|
| `LOCAL PHOTO LIBRARY.photoslibrary` | **5023** | ~43 GB |
| `Photos Library.photoslibrary` (iCloud) | **3512** | ~37 GB |
| Immich DB assets（上傳前） | **~3143** | — |

**CLI dry-run（local-archive）**：

```
Found 5023 new files and 0 duplicates
```

→ LOCAL archive 原檔與 **Immich DB 內 assets 無 hash 重複**；正在上傳是正確路徑（原檔 + EXIF）。

**推測**：既有 ~3143 assets 多半來自 **iCloud / iOS App** 子集（3512 接近）；LOCAL archive 是移出 iCloud 的 archive，對 DB 幾乎全新。

**icloud-primary** 待 local-archive 完成後 dry-run；預期 **大量 duplicates、少量 new**。

---

## 續傳

中斷後 **重跑同一指令**即可；CLI 依 hash skip 已完成檔：

```bash
./scripts/photo-sync/immich-sync.sh --library local-archive
```

---

## 後續清理（Phase 3 完成後）

1. 確認 Immich Web UI 照片齊全 + 相簿 `Mac Photos (Local Archive)`
2. 評估刪除冗餘：
   - `/mnt/immich/external-library`（43 GB，`assetCount: 0`）
   - `/data/external-library`（若確認為副本）
3. **勿刪** `/data/upload`（正式 library）
4. Phase 4/5：SSD 優化 + B2 備份

Runbook: [PHASE3_EXTERNAL_LIBRARY_CLEANUP.md](./PHASE3_EXTERNAL_LIBRARY_CLEANUP.md)

---

**相關**: [PHASE3_PHOTO_SYNC.md](./PHASE3_PHOTO_SYNC.md) · [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md) §3.2.1
