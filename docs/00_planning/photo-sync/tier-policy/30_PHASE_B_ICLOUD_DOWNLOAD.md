# Phase B — iCloud ismissing 下載策略

**狀態**: 📋 規劃中  
**前置**: Phase 3.5 M3 第一輪 local-path **1615/1615** 完成（2026-06-14）

---

## 背景

| 指標 | 數值 |
|------|------|
| cutoff 一年前 eligible | **5895** |
| 已 export/import（local-path） | **1615** ✅ |
| 待處理 `ismissing` | **4119** |
| icloud-primary 現役 | **4815**（1615 在 Recently Deleted） |

---

## 步驟

### 1. 觸發 iCloud 原尺寸下載

在 Photos 開啟 **icloud-primary**：

1. **照片** → **設定** → 勾選「**將此 Mac 上的照片和影片下載原尺寸**」
2. 瀏覽「所有照片」或依年份滾動，觸發 thumbnail-only 項目下載
3. 監控：`osxphotos` 中 `ismissing` 數量下降、`originals/` 檔案增加

```bash
export PATH="$HOME/.local/bin:$PATH"
python3 - <<'PY'
import osxphotos
db = osxphotos.PhotosDB("/Users/light0/Pictures/Photos Library.photoslibrary")
photos = list(db.photos())
missing = sum(1 for p in photos if p.ismissing)
local = sum(1 for p in photos if p.path and not p.ismissing)
print(f"total={len(photos)} local={local} ismissing={missing}")
PY
```

### 2. Re-export + import

下載完成後（`ismissing` 對 eligible 批次為 0）：

```bash
./scripts/photo-sync/tier-policy-bulk-export.sh --cutoff-one-year
IMPORT_MODE=auto ./scripts/photo-sync/tier-policy-bulk-import-staging.sh
./scripts/photo-sync/tier-policy-verify-staging.sh
./scripts/photo-sync/tier-policy-delete-source.sh --yes --skip-gui
# → Photos GUI：TierPolicy-Delete 相簿 → ⌘A → ⌘Delete
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

- `scripts/photo-sync/audit-icloud-videos.sh` — video DB/disk/Immich 報告
- `scripts/photo-sync/tier-policy-bulk-export.sh`
- `scripts/photo-sync/tier-policy-verify-staging.sh`
