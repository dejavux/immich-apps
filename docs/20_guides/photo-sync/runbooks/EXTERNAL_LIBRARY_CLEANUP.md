# Phase 3：External Library 冗餘清理 Runbook

**狀態**: ✅ **已完成**（2026-06-12；~86 GB 釋放）  
**前置**: [STORAGE_AUDIT.md](./STORAGE_AUDIT.md) · local-archive 全量上傳完成

---

## 背景

Immich 節點約 **~86 GB** 為未 index 的 external-library 副本（`assetCount: 0`），與 `/data/upload` 正式 library 無關。清理可釋放磁碟，**不影響**已上傳 assets。

| 路徑 | 約略大小 | 說明 |
| ------ | --------- | ------ |
| `/external-library` | 43 GB | hostPath 舊 rsync |
| `/data/external-library` | 43 GB | PVC 內同內容副本 |
| `/data/upload` | — | **勿刪** — 正式 library |

---

## 清理前檢查清單

- [ ] `local-archive` 全量上傳完成（CLI 0 new） — **done**
- [ ] `icloud-primary` dry-run / 增量已完成（可選，建議）
- [x] Immich Web UI 抽查相簿、日期、EXIF
- [x] External library 磁碟副本已清（Admin library 仍指向空 `/external-library`）
- [ ] 已備份或接受刪除 hostPath 副本（Phase 5 B2 尚未上線） — **已執行清理**

---

## 步驟

### 1. Dry-run（預設）

```bash
./scripts/photo-sync/cleanup-external-library.sh
```

會列出兩路徑 `du` 與檔案數，不刪除任何檔案。

### 2. 執行刪除

```bash
./scripts/photo-sync/cleanup-external-library.sh --execute
```

需輸入 `YES` 確認。腳本透過 `immich-server` pod 刪除目錄內容。

### 3. 驗收

```bash
kubectl exec -n immich deploy/immich-server -- du -sh /data/upload /data/external-library /external-library
```

預期：`external-library` 兩路徑接近空目錄；`/data/upload` 不變。

---

## 回滾

若誤刪且無 B2 備份：只能從 Mac Photos Library 重新 sync（hash skip 已存在 assets）。

---

## 相關

- [10_REQUIREMENTS.md](../../../60_completed/phase3-photo-sync-bulk/10_REQUIREMENTS.md)
- [PROGRESS_TRACKING.md](../../../00_planning/PROGRESS_TRACKING.md) §3.3
