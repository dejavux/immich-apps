# Phase 3.5 Gate 狀態（Handoff）

**評估時間**：2026-06-23（Ops W1–W3 + pg 備份追蹤）  
**評估者**：Orchestrator + Agent 執行

---

## 總結

| 項目 | 結果 |
| ------ | ------ |
| **Phase 3.5 gate** | **PASS（含豁免）** |
| **Phase 3.5 結案** | ✅ |
| **建議 Wave** | **W4 prep 完成**；SSD 執行待 5a PASS + 停機批准 |
| **Cluster/deploy 工作** | Phase 1 ✅ deploy · 5a 🟡 **1/2 pg 排程** · 5b 🟡 · 4 prep ✅ |

---

## Gate Criteria 逐項

| 準則 | 狀態 | 證據 |
| ------ | ------ | ------ |
| reconcile dry-run `orphan_ready_for_apply: 0` | ✅ PASS | `reconcile-20260622-203149.json` |
| tier verify `staging_items: 0` | ✅ PASS | `tier-policy-status.sh` |
| icloud/local sync dry-run | ✅ PASS | 歷次全量 + LaunchAgent 增量 **0 new** |
| 23 張手動還原 | ⏭️ **豁免** | 使用者決策：不執行 |
| Recently Deleted 永久清除 | ⏭️ **豁免** | **family shared** 照片無法刪除；**103** 筆保留 |
| album reconcile stale=0 missing=0 | 🟡 P2 可選 | stale **27** · missing **123**；不阻擋 3.5 結案 |

---

## Phase 5a Gate（備份）

| 準則 | 狀態 | 證據 |
| ------ | ------ | ------ |
| pg 還原演練 | ✅ PASS | `asset` **13759** = prod（2026-06-22） |
| pg CronJob 連續 2 次排程 Success | 🟡 **1/2** | `immich-pg-backup-29702580` Complete @ 2026-06-23 03:00；下次 06-24 03:00 |
| B2 secret + 上傳驗證 | ⏳ **BLOCKED** | `immich-b2-backup` secret 未同步；bootstrap 腳本已就緒 |
| data 備份 Job Success | ⏳ **BLOCKED** | 依賴 B2 secret；週日 04:00 或手動 `--trigger-data-backup` |

**手動驗證**（不計入 gate）：`immich-pg-backup-manual-*`、`immich-pg-backup-verify-*` 均 Complete（93MB gzip）。

**結論**：Phase 5a = **PARTIAL** — 待 B2 item + 第 2 次排程 pg Success。

---

## Agent Prompts 執行狀態（vs 文件）

| Task | Prompt 文件 | 已 commit | Cluster 執行 | 進度 |
| ------ | ------------- | ----------- | -------------- | ------ |
| Orchestrator | `orchestrator.md` | ✅ `b66f3ee` | gate 評估 | 編排就緒 |
| 3.5 Gate | `phase-3.5-gate.md` | ✅ | reconcile ✅ · **結案** | **100%** |
| 1 Hardening | `phase-1-hardening.md` | 🟡 待 commit | ✅ deploy 2026-06-22 | **~85%**（Redis item 待建） |
| 5a Backup | `phase-5a-backup.md` | 🟡 待 commit | 🟡 CronJob + 本機備份 | **~75%**（B2 待 item · pg 1/2） |
| 5b Monitoring | `phase-5b-monitoring.md` | 🟡 待 commit | 🟡 PrometheusRule | **~50%**（Grafana 待匯入） |
| 4 SSD | `phase-4-storage-ssd.md` | 🟡 待 commit | prep only | **~30%**（runbook + 盤點） |

---

## Task 解鎖狀態

| Task | 說明 | 狀態 |
| ------ | ------ | ------ |
| **A** Phase 3.5 Gate | tier 收尾 | ✅ **完成** |
| **B** Phase 5a Backup | B2 + pg_dump CronJob | 🟡 **PARTIAL**（B2 待 item · pg 1/2 排程） |
| **C** Phase 1 Hardening | manifest + deploy | ✅ **deploy 完成** |
| **D** Phase 4 SSD | Postgres NVMe | 🟡 **prep 完成**（執行 BLOCKED：5a PASS + 批准） |
| **E** Phase 5b Monitoring | Grafana + 告警 | 🟡 **規則已 deploy**（dashboard 待匯入） |

---

## 下一動作（Orchestrator）

1. **使用者**（需 `op signin`）：

   ```bash
   B2_APPLICATION_KEY_ID=... B2_APPLICATION_KEY=... B2_BUCKET=... \
     bash infra-bootstrap/60_apps/immich/scripts/create-immich-b2-backup-op-item.sh
   bash infra-bootstrap/60_apps/immich/scripts/bootstrap-immich-secrets.sh --wait-b2 --trigger-data-backup
   ```

2. **等待** 2026-06-24 03:00 第二次 pg CronJob → 更新本檔為 5a **PASS**
3. **可選**：`create-immich-redis-op-item.sh` + `bootstrap-immich-secrets.sh --rollout-redis`
4. **Phase 4**：5a PASS 後，批准停機窗執行 [STORAGE_MIGRATION.md](../../20_guides/infra/runbooks/STORAGE_MIGRATION.md)
5. **5b**：依 [IMMICH_DASHBOARD_SPEC.md](../../20_guides/infra/monitoring/IMMICH_DASHBOARD_SPEC.md) 匯入 Grafana
