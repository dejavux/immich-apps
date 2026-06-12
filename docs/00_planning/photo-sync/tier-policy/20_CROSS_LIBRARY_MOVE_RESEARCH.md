# Phase 3.5 — 跨 library 移動研究（M2）

**狀態**: 🟡 PoC 計數完成 · 尚未 execute  
**最後更新**: 2026-06-13

---

## 問題

tier policy 目標：將 **eligible** 舊照片從 `icloud-primary` 移出，改存 `local-archive`，以釋放 iCloud 配額。Immich 已有 union 備份，搬移後 sync 應維持 **0 new**。

本文件記錄 **能否安全自動化**，PoC **只計數、不搬檔**。

---

## 工具能力摘要

| 能力 | osxphotos | photoscript | AppleScript / Photos UI |
|------|-----------|-------------|-------------------------|
| 讀取指定 library | ✅ `--library path` | ✅ `PhotosLibrary.open(path)` | ⚠️ 需 Option+開啟切換 |
| 查詢 eligible（日期） | ✅ `query --to-date` / Python API | — | — |
| 匯出 original | ✅ `export`（含 Live Photo flags） | ✅ `Photo.export()` | ✅ 匯出 |
| 匯入至指定 library | ⚠️ `import` 用「最後開啟的 library」 | ✅ `import_photos(..., album=)` | ✅ |
| 從 source 刪除 | ❌ 無 CLI | ❌ 無 `delete` | ✅ 可（需人工 gate） |
| 跨 library 比對 | ✅ `compare LIB_A LIB_B` | hash / fingerprint 自比 | — |

**結論**：可行路徑是 **export → photoscript import 至 target → 人工或 AppleScript 自 source 刪除**。osxphotos **沒有一鍵「move between libraries」**。

---

## PoC 計數結果（`cutoff_date: 2023-01-01`）

執行：

```bash
export PATH="$HOME/.local/bin:$PATH"
./scripts/photo-sync/tier-policy-cross-library-poc.sh
./scripts/photo-sync/tier-policy-spotcheck.sh
```

### eligible 分桶（2900 張）

| 分桶 | 數量 | 說明 |
|------|------|------|
| eligible 總計 | **2900** | 建立日期早於 cutoff |
| 已有 local path（可立即 export/hash） | **577** | originals 目錄有檔 |
| iCloud-only（`ismissing`） | **2188** | 需先下載才能 export |
| 已在 `local-archive`（fingerprint 比對） | **0** | 尚未搬過 |
| Live Photo | （見 JSON） | export 需 `--live-photo` |
| Shared library | （見 JSON） | 可能不宜自動刪 source |

### Immich hash 重疊（spot-check）

| 指標 | 值 |
|------|-----|
| 可 hash 的 local eligible | **577** |
| Immich `bulk-upload-check` reject（dup） | **577** |
| 重疊率 | **100%** |

**解讀**：所有 **已下載到 Mac** 的 eligible 子集，SHA1 皆已在 Immich。其餘 **2188** 張因 iCloud-only 無法本地 hash，但 Phase 3 全量 sync 曾顯示 icloud originals **2789 dup / 0 new**，推論大多數亦已在 Immich（待下載後可抽樣驗證）。

---

## 建議 execute 流程（M3 前設計）

```text
for each eligible photo in source (batch):
  1. skip if fingerprint already in target library
  2. if ismissing: skip OR trigger iCloud download (out of scope v1)
  3. export to staging (preserve Live Photo pair, XMP if any)
  4. photoscript: open(local-archive) → import_photos → album
  5. verify target import (fingerprint match)
  6. manual gate / AppleScript: remove from icloud-primary
  7. immich-sync --dry-run → expect 0 new (or +1 once per moved file)
```

### 風險與緩解

| 風險 | 緩解 |
|------|------|
| iCloud 重新下載已刪項目 | 先移 **Immich 已確認 dup** 且 **local path 存在** 的 577 張 |
| Live Photo 拆 pair | `osxphotos export --live-photo mov` |
| import 錯 library | **必須** `photoscript.PhotosLibrary.open(target_path)` |
| source 刪除不可逆 | `dry_run` + batch_size + 人工確認前 N 批 |
| sync storm | tier 與 fswatch 錯開 |

---

## 參考

- [osxphotos compare](https://rhettbull.github.io/osxphotos/cli.html#compare)
- [PhotoScript import_photos](https://rhettbull.github.io/PhotoScript/)
- [10_REQUIREMENTS.md](./10_REQUIREMENTS.md)
- `scripts/photo-sync/tier-policy-cross-library-poc.sh`
- `scripts/photo-sync/tier-policy-spotcheck.sh`
