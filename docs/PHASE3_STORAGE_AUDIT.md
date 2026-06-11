# Phase 3：Immich 伺服器儲存盤點

**日期**: 2026-06-12（更新）  
**節點**: `lama` · namespace `immich` · PVC `/data`

---

## 摘要

使用者觀察 Immich 約 **~100GB+** 磁碟占用。盤點結果：

1. **已刪除** ~86 GB 的 external-library **磁碟副本**（與 `/data/upload` 無關）。
2. **`/data/upload` 內沒有「同 hash 存兩份原檔」**：Immich CLI / server 依 **checksum dedupe**，duplicate 只加 DB 列、**不複製 blob**。
3. **兩個 Mac library 內容幾乎不重疊**：local 5023 + icloud 3512 僅 **1 hash dup** → union 後 `/data/upload` 會接近 **兩邊原檔加總**（~80–90 GB），這是預期行為，不是 upload 目錄裡的 duplicate 副本。
4. 另加 **encoded-video / thumbs**（轉檔與縮圖），不算原檔 duplicate。

---

## 磁碟配置（2026-06-12，external 已清理）

| 路徑 | 大小 | 檔案數（約） | 說明 |
|------|------|-------------|------|
| `/data/upload` | **88 GB** ↑ | ~13300 | 正式 library **原檔**（每 asset 一 blob；hash 相同則共用） |
| `/data/encoded-video` | **32 GB** | — | 影片轉檔（每支影片一份，非原檔 dup） |
| `/data/thumbs` | **3 GB** | — | 縮圖 |
| `/external-library` | **4 KB** | 0 | 已清理 |
| `/data/external-library` | **4 KB** | 0 | 已清理 |

**合計** ~123 GB（原檔 + 轉檔 + 縮圖）。icloud-primary 上傳中，`/data/upload` 仍會長。

---

## `/data/upload` 與 duplicate 的關係

| 層級 | 行為 | 磁碟影響 |
|------|------|----------|
| **CLI「Found N duplicates」** | 本機檔 hash 已在 Immich DB | **不上傳** → upload 目錄**不增加** |
| **Immich DB `duplicateId`** | 多個 asset 列指向同一 checksum | **一個** blob |
| **local + icloud 兩 library** | 不同 Photos Library、不同 originals | 若 hash 不同 → **各存一份**（union 備份） |

**2026-06-12 icloud dry-run**：`3511 new, 1 duplicate`（對已存在 ~6278 assets 僅 1 檔 hash 重疊）。  
→ 先前「icloud 會大量 dup」假設**不成立**；兩 library 是 **disjoint 為主**。

**DB vs 檔案數**：`find /data/upload -type f` ≈ 13331，assets ≈ 6278（上傳中）。Live Photo（HEIC + MOV）、影片與多版本會讓 **asset 數 ≠ 檔案路徑數**；需用 Admin 或 DB 查 `duplicateId` 群組評估邏輯重複，非目錄內雙份原檔。

---

## Immich DB（API `/server/statistics`）

| 指標 | 2026-06-11 上傳前 | 2026-06-12（icloud 上傳中） |
|------|-------------------|----------------------------|
| Photos | ~2731 | **5444** |
| Videos | ~412 | **834** |
| **Total assets** | ~3143 | **~6278** |
| Reported usage | — | ~47 GB（DB 統計；磁碟含 upload+encoded 更大） |

---

## Mac vs Immich 比對

| 來源 | originals 檔案數 | 大小 |
|------|-----------------|------|
| `LOCAL PHOTO LIBRARY` | **5023** | ~43 GB |
| `Photos Library` (iCloud) | **3512** | ~37 GB |
| **Hash 重疊（icloud vs DB）** | **1** | — |

**local-archive**（完成）：`0 new / 5023 dup`  
**icloud-primary**（進行中，2026-06-12 ~22%）：`3511 new / 1 dup`，約 32 GB 待傳

**Union 預估原檔**：~5023 + 3511 − 1 ≈ **8533 unique blobs** → `/data/upload` 最終 ~**90–95 GB**（加既有 App 上傳重疊修正）。

---

## 續傳

```bash
./scripts/photo-sync/immich-sync.sh --library icloud-primary
```

---

## 後續

1. [x] 清理 external-library 冗餘（~86 GB）
2. [ ] icloud-primary 全量完成 → dry-run `0 new`
3. [ ] Admin：停用或移除空的 External library「Migrated photos」
4. [ ] Phase 5：B2 備份 `/data/upload`

Runbook: [PHASE3_EXTERNAL_LIBRARY_CLEANUP.md](./PHASE3_EXTERNAL_LIBRARY_CLEANUP.md)

---

**相關**: [PHASE3_PHOTO_SYNC.md](./PHASE3_PHOTO_SYNC.md) · [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md) §3.3
