# Phase 3.5 Gate 狀態（Handoff）

**評估時間**：2026-06-23（NFS 首次 rsync Complete · Grafana apply）  
**評估者**：Orchestrator + Agent 執行

---

## 總結

| 項目 | 結果 |
| ------ | ------ |
| **Phase 3.5 gate** | **PASS（含豁免）** |
| **Phase 3.5 結案** | ✅ |
| **建議 Wave** | **W4 prep 完成**；SSD 執行待 5a PASS + 停機批准 |
| **Cluster/deploy 工作** | Phase 1 ✅ · 5a 🟡 **~90%** · 5b 🟡 **~70%** · 4 prep ✅ |

---

## Gate Criteria 逐項

| 準則 | 狀態 | 證據 |
| ------ | ------ | ------ |
| reconcile dry-run `orphan_ready_for_apply: 0` | ✅ PASS | `reconcile-20260622-203149.json` |
| tier verify `staging_items: 0` | ✅ PASS | `tier-policy-status.sh` |
| icloud/local sync dry-run | ✅ PASS | 歷次全量 + LaunchAgent 增量 **0 new** |
| 23 張手動還原 | ⏭️ **豁免** | 使用者決策：不執行 |
| Recently Deleted 永久清除 | ⏭️ **豁免** | **family shared**；**103** 筆保留 |
| album reconcile stale=0 missing=0 | 🟡 P2 可選 | stale **27** · missing **123** |

---

## Phase 5a Gate（備份 · NFS）

| 準則 | 狀態 | 證據 |
| ------ | ------ | ------ |
| pg 還原演練 | ✅ PASS | `asset` **13759** = prod（2026-06-22） |
| pg CronJob 連續 2 次排程 Success | 🟡 **1/2** | `immich-pg-backup-29702580` @ 06-23 03:00；下次 **06-24 03:00** |
| NFS data 備份 Job Success | ✅ PASS | `immich-data-backup-nfs-test-1782176320` Complete **7h34m**；**157.8G** @ `/backup/immich/upload/20260623/` |
| B2 | ⏭️ **已廢止** | item 已刪（Infra-Apps + Platform）；cluster 無 B2 secret |

**決策**：備份第二副本改 **delta NFS**（PR #174 / #29 merged）；不採 Backblaze B2。

**結論**：Phase 5a = **PARTIAL（~90%）** — NFS ✅；待 pg 第 2 次排程 Success（**06-24 03:00**）→ **PASS**。

---

## Agent Prompts 執行狀態

| Task | 已 merge | Cluster | 進度 |
| ------ | ---------- | --------- | ------ |
| 3.5 Gate | ✅ | 結案 | **100%** |
| 1 Hardening | ✅ PR #174 | deploy + Redis secret | **~90%** |
| 5a Backup | ✅ PR #174/#29 | NFS PVC + CronJob · 首次 data Job ✅ | **~90%** |
| 5b Monitoring | ✅ | PrometheusRule + Grafana ConfigMap apply + rollout | **~70%**（deep link / Telegram smoke 待驗） |
| 4 SSD | ✅ prep | 未執行 | **~30%** |

---

## Task 解鎖狀態

| Task | 狀態 |
| ------ | ------ |
| **A** Phase 3.5 Gate | ✅ |
| **B** Phase 5a Backup | 🟡 NFS ✅ · pg **1/2**（06-24 03:00） |
| **C** Phase 1 Hardening | ✅ deploy（Redis 已 rollout） |
| **D** Phase 4 SSD | 🟡 BLOCKED：5a PASS + 停機批准 |
| **E** Phase 5b Monitoring | 🟡 Grafana apply + rollout ✅；驗證 `/d/immich-ops` + Telegram smoke |

---

## 下一動作

1. **06-24 03:00** 第二次 pg CronJob → Success → 更新 5a **PASS**
2. **5b**：驗證 `https://grafana.3q.fi/d/immich-ops` + Telegram 告警 smoke
3. **Phase 4**：5a PASS 後批准停機窗 → [STORAGE_MIGRATION.md](../../20_guides/infra/runbooks/STORAGE_MIGRATION.md)
4. **Ops W2**（Q3）：Mac library → delta NFS（[BACKLOG.md](../BACKLOG.md)）
