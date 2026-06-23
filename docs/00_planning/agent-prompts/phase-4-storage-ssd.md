# Phase 4 — PostgreSQL / 縮圖遷移至 NVMe SSD

> Subagent prompt：Postgres（與可選 thumbs）遷至 lama NVMe；**硬依賴** Phase 3.5 + Phase 5a gate PASS。

---

## 目標

將 **postgres-data**（與可選 **thumbs**）從 HDD `/mnt/immich` 遷到 lama NVMe，降低查詢延遲；  
**不**搬移 `/data/upload`（~115GB 留 HDD）。

---

## 依賴（全部為硬依賴）

| 依賴 | 說明 |
| ------ | ------ |
| Phase 3.5 gate | PASS |
| Phase 5a gate | PASS（還原演練成功） |
| Phase 1 probes | 建議完成（遷移後驗收 rollout） |
| **使用者確認** | 維護窗口 30–60 分鐘、`https://immich.3q.fi` 可接受短暫不可用 |

---

## Multi-task（遷移當日序列執行，不可平行）

| 步驟 | 任務 | 停機 |
| ------ | ------ | ------ |
| 4-1 | 維護公告 + 最終 pg_dump | 否 |
| 4-2 | scale down server/ml | 是 |
| 4-3 | stop postgres · rsync postgres-data → NVMe | 是 |
| 4-4 | 新 PV/subPath 或 hostPath 掛載 | 是 |
| 4-5 | start postgres → server → ml | 是 |
| 4-6 | 效能基準 + smoke test | 否 |

**遷移前可平行（準備階段）**：

| ID | 任務 |
| ---- | ------ |
| 4-prep-A | lama 上確認 NVMe 掛載點與剩餘空間（`df`, `lsblk`） |
| 4-prep-B | 撰寫 `STORAGE_MIGRATION.md` runbook |
| 4-prep-C | staging 演練（可選：temp pod 掛載測試） |

---

## 路徑

- `infra-bootstrap/60_apps/immich/immich-local-pv.yaml`
- `infra-bootstrap/60_apps/immich/immich-deployment.yaml` — postgres `subPath: postgres-data`
- 目標例：`/nvme/immich-postgres`（以 lama 實際掛載為準）
- 盤點：`immich-apps/docs/20_guides/photo-sync/runbooks/STORAGE_AUDIT.md`

---

## 執行步驟

1. 讀 `STORAGE_AUDIT.md`、確認 upload **不**遷。
2. prep：空間規劃（postgres + thumbs < NVMe 可用）。
3. 維護窗：Recreate 策略下依序停服務。
4. `rsync -aH` postgres-data；校驗 size/inode。
5. 修改 PV 或 postgres volumeMount（**僅** DB 路徑）。
6. 重啟後：`psql` 擴展檢查、Immich Web 瀏覽、Smart Search 抽測。
7. 效能：記錄 migration 前後簡單查詢延遲（目標 -50% 為 aspirational，記錄實測即可）。
8. 遷移後 24h：確認 Mac photo-sync 無異常 reconcile orphan。

---

## 驗收標準

- [ ] 所有 pod Ready，無 CrashLoop
- [ ] asset count 與遷移前一致
- [ ] LINE bot 上傳 + 搜尋 smoke
- [ ] 遷移後 24h 無新增 reconcile orphan 異常
- [ ] `PROGRESS_TRACKING.md` Phase 4 → 100%

---

## 回滾

runbook **必含**：

- 還原舊 hostPath
- 從 Phase 5a 最新 dump restore

---

## 禁止

- Phase 5a 還原演練未 PASS 時執行停機遷移
- 遷移停機窗內執行 `immich-sync.sh` / tier bulk
- 未經使用者確認的維護窗

---

## Handoff

- 遷移前後 `df` / `lsblk` 輸出
- 實測延遲對照表
- `Phase 4: COMPLETE` + commit/PR 連結
