# Phase 3.5 Gate 狀態（Handoff）

**評估時間**：2026-06-24（pg 2/2 · 5a PASS · Grafana 修復 · Phase 4 批准）  
**評估者**：Orchestrator + Agent 執行

---

## 總結

| 項目 | 結果 |
| ------ | ------ |
| **Phase 3.5 gate** | **PASS（含豁免）** |
| **Phase 3.5 結案** | ✅ |
| **建議 Wave** | **W4 執行待排程**；5b **~95%**（Grafana 有資料 · smoke 已重送） |
| **Cluster/deploy 工作** | Phase 1 ✅ · 5a ✅ **PASS** · 5b 🟡 **~95%** · 4 **已批准**（執行待排程） |

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
| pg CronJob 連續 2 次排程 Success | ✅ PASS | `immich-pg-backup-29702580` @ **06-23 03:00** · `immich-pg-backup-29704020` @ **06-24 03:00**（CronJob `immich-pg-backup`） |
| NFS data 備份 Job Success | ✅ PASS | `immich-data-backup-nfs-test-1782176320` Complete；**157.8G** @ `/backup/immich/upload/20260623/` |
| B2 | ⏭️ **已廢止** | item 已刪（Infra-Apps + Platform）；cluster 無 B2 secret |

**決策**：備份第二副本改 **delta NFS**（PR #174 / #29 merged）；不採 Backblaze B2。

**結論**：Phase 5a = **PASS**（pg 2/2 + NFS ✅）。

---

## Agent Prompts 執行狀態

| Task | 已 merge | Cluster | 進度 |
| ------ | ---------- | --------- | ------ |
| 3.5 Gate | ✅ | 結案 | **100%** |
| 1 Hardening | ✅ PR #174 | deploy + Redis secret | **~90%** |
| 5a Backup | ✅ PR #174/#29 | pg 2/2 + NFS Job ✅ | **100%** |
| 5b Monitoring | ✅ | PrometheusRule + Grafana · RBAC 修復 · immich OTEL metrics | **~95%**（smoke 已重送 3 條） |
| 4 SSD | ✅ prep | **停機窗已批准 2026-06-24** · 執行待排程 | **~35%** |

---

## Task 解鎖狀態

| Task | 狀態 |
| ------ | ------ |
| **A** Phase 3.5 Gate | ✅ |
| **B** Phase 5a Backup | ✅ **PASS** |
| **C** Phase 1 Hardening | ✅ deploy（Redis 已 rollout） |
| **D** Phase 4 SSD | ✅ **已批准**（2026-06-24）· 執行待排程 → [STORAGE_MIGRATION.md](../../20_guides/infra/runbooks/STORAGE_MIGRATION.md) |
| **E** Phase 5b Monitoring | 🟡 Grafana 有資料 · Telegram smoke 已重送（待使用者確認 3 條） |

---

## 下一動作

1. **5b**：確認 Telegram 收到 3 條 smoke（🤖⚠️ Sentinel · ⚠️ Platform · ⚠️ Immich-backup）
2. **Phase 4**：排定停機窗執行 → [STORAGE_MIGRATION.md](../../20_guides/infra/runbooks/STORAGE_MIGRATION.md)（Postgres `subPath` → lama NVMe）
3. **Ops W2**（Q3 · **建議延後**）：Mac `.photoslibrary` → delta NFS — 可先做 prep（delta 路徑、LaunchAgent 設計），**不阻塞** Phase 4（見 [BACKLOG.md](../BACKLOG.md) · [MAC_LIBRARY_BACKUP.md](../../20_guides/infra/runbooks/MAC_LIBRARY_BACKUP.md)）
4. **Observability**：fuqi 儀表板併入 monitoring ConfigMap 或獨立子網域（見 [OBSERVABILITY_ROADMAP.md](../../20_guides/infra/monitoring/OBSERVABILITY_ROADMAP.md)）
