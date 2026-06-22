# Phase 5a — Immich 備份自動化（B2 + pg_dump）

> Subagent prompt：建立 3-2-1 備份第一層；**硬前置** Phase 3.5 gate PASS。

---

## 目標

建立 3-2-1 備份第一層：

- 每日 PostgreSQL dump
- 每週照片/metadata 備份至 Backblaze B2
- 完成 **還原演練**（阻擋 Phase 4 的硬 gate）

---

## 依賴

- **硬前置**：Phase 3.5 gate PASS（見 `GATE_STATUS.md`）
- **阻擋 Phase 4**：還原演練未通過前不得啟動 SSD 遷移
- **使用者輸入**：B2 account、bucket 名稱、保留策略（預設 30 天 daily / 90 天 weekly）

---

## Multi-task 可平行子任務

| ID | 任務 | 可平行 | 備註 |
|----|------|--------|------|
| 5a-A | B2 bucket + 1Password item 設計 | ✅ | 需使用者確認後建立 |
| 5a-B | pg_dump CronJob manifest | ✅ | 參考 v2.7.5 手動 dump 流程 |
| 5a-C | 照片上傳目錄備份 CronJob（restic/rclone） | ✅ | 可與 B 平行 |
| 5a-D | 還原 runbook + 演練 | ❌ | 須在 B/C 首次成功備份後 |

---

## 參考

- `immich-apps/docs/60_completed/immich-v2.7.5-upgrade/`（pg_dump 範例）
- `immich-apps/docs/20_guides/infra/upgrades/IMMICH_v2.7.5.md`
- Cluster：`namespace immich`，node `lama`，PVC `/mnt/immich`
- 現有 1Password pattern：`infra-bootstrap/60_apps/immich/1password-items.yaml`

---

## 執行步驟

1. 確認 Phase 3.5 gate（讀 `GATE_STATUS.md` 與最新 reconcile 報告）。
2. 設計 1Password item `Immich-B2-Backup`（`application-key-id`, `application-key`, `bucket`, `endpoint`）。
3. 在 `infra-bootstrap/60_apps/immich/` 新增：
   - CronJob `immich-pg-backup`（每日 03:00 UTC+8 或叢集慣例時區）
   - CronJob `immich-data-backup`（每週日；可只備 `/data/upload` + postgres dump 路徑）
   - Secret 來自 `OnePasswordItem`（與現有 pattern 一致）
4. **使用者確認後**建立 B2 bucket；首次手動 trigger Job，確認 B2 有物件。
5. 撰寫 `immich-apps/docs/20_guides/infra/runbooks/BACKUP_RESTORE.md`：
   - pg 還原到 staging namespace 或 temp pod
   - 驗證 `SELECT count(*) FROM assets`
6. 執行一次還原演練（可縮小 DB），記錄耗時。
7. 更新 `BACKLOG.md` Phase 5 前三項。

---

## 驗收標準

- [ ] 連續 2 次 pg_dump CronJob Success
- [ ] B2 可 list 備份物件（含日期前綴）
- [ ] 還原演練：DB row count 與 prod 同數量級
- [ ] runbook 可讓另一位工程師照做
- [ ] `BACKLOG.md` Phase 5 前三項勾選

---

## 禁止

- Phase 3.5 gate FAIL 時建立 B2 bucket 或 deploy CronJob 到 prod
- commit B2 application key 明文
- 刪除既有 B2 物件（除非使用者明確要求）

---

## Handoff → Phase 4

- B2 bucket 名稱、最新 backup 路徑
- 還原演練日期 + 耗時
- **明確一行**：`Phase 5a gate: PASS` 或 `FAIL`

PASS 後 Wave 可規劃 **W4**（需使用者批准停機窗）。
