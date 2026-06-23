# Phase 3.5 — iCloud 分層收尾（Gate）

> Subagent prompt：關閉 Phase 3.5，使 Mac↔Immich 資料一致後才允許 Phase 5/4。

---

## 目標

關閉 Phase 3.5，使 Mac↔Immich 資料一致，orphan dry-run 可接受，再讓 Phase 5/4 開工。

---

## 依賴

- **前置**：Phase 3/3.6 已結案（✅）
- **阻擋**：本 Phase 未完成 → Phase 5、Phase 4 **不得** deploy

---

## Multi-task 可平行子任務

| ID | 任務 | 可平行 | 備註 |
| ---- | ------ | -------- | ------ |
| 3.5-A | `immich-reconcile.sh` dry-run 驗證 | ✅ | 與 B 可同時 |
| 3.5-B | local-archive `immich-sync.sh --library local-archive` | ⚠️ | 與 reconcile apply 錯開 |
| 3.5-C | Recently Deleted 23 張手動還原（GUI） | ✅ | 人工；agent 只產 checklist |
| 3.5-D | purge Recently Deleted + 永久清除 | ❌ | 須在 C 完成後 |

---

## Repo / 路徑

- `immich-apps/scripts/photo-sync/`
- `immich-apps/docs/00_planning/photo-sync/tier-policy/`
- Runbook：`immich-apps/docs/20_guides/photo-sync/runbooks/TIER_POLICY.md`
- Reconcile：`immich-apps/docs/20_guides/photo-sync/runbooks/RECONCILE_OPERATIONS.md`
- 報告：`~/Library/Logs/immich-photo-sync/recovery/`
- Reconcile JSON：`~/Library/Logs/immich-photo-sync/reconcile/reconcile-*.json`

---

## 執行步驟

1. 讀 `PROGRESS_TRACKING.md` §3.5、`HOW_TO_PROCEED.md` 確認待辦。
2. 跑 `./scripts/photo-sync/tier-policy-status.sh` 取得單頁摘要。
3. 跑 `./scripts/photo-sync/immich-reconcile.sh`（先 dry-run，記錄 orphan/stale/missing）。
4. 若 `recovery/trashed-restore-23.json` 存在，產出 **人工還原 checklist**（Photos GUI 步驟）；**勿**代替使用者在 GUI 操作。
5. 使用者確認 purge 完成後，才考慮 `immich-reconcile.sh --apply --confirm`（若 dry-run 有 `orphan_ready_for_apply > 0`）。
6. `./scripts/photo-sync/immich-sync.sh --library local-archive` 確認 9 new 已上傳（可先 `--dry-run`）。
7. `./scripts/photo-sync/immich-icloud-album-reconcile.sh --dry-run` → stale=0 · missing=0。
8. 更新 `PROGRESS_TRACKING.md`：Phase 3.5 → 100%，移除「待完成」項。
9. 撰寫或更新 `agent-prompts/GATE_STATUS.md`：`Phase 3.5 gate: PASS/FAIL` + 證據。

---

## 驗收標準（Gate Criteria）

- [ ] reconcile dry-run：`orphan_ready_for_apply: 0`（或已 apply 並說明剩餘）
- [ ] tier verify：`staging_items: 0`
- [ ] icloud-primary / local-archive dry-run：`0 new`（或僅預期增量）
- [ ] `immich-icloud-album-reconcile.sh --dry-run`：stale=0 · missing=0
- [ ] Recently Deleted **已永久清除**（`ZTRASHEDSTATE=1` 僅剩 family shared 等不可刪項，或使用者書面確認）
- [ ] 使用者確認 23 張還原已完成（或記錄 defer 風險）

---

## 禁止

- 未經使用者確認執行 Recently Deleted **永久清除**（GUI 不可逆）
- 在 purge 完成前執行 `reconcile --apply`
- 啟動 Phase 5 B2 / CronJob / Phase 4 任何 cluster 變更
- commit 或 log 明文 Immich API key / 1Password 內容

---

## Handoff → Phase 5

回傳給 Orchestrator：

- 最後一次 reconcile JSON **路徑**與 summary 欄位
- tier-policy-status 輸出摘要
- icloud / local-archive dry-run 結果
- **明確一行**：`Phase 3.5 gate: PASS` 或 `FAIL`（附未過項）

若 PASS，Wave 可進 **W1**（Task B + 可選 Task C）。
