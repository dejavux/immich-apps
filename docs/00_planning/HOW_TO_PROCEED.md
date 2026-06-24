# 如何進行 — Immich Apps 執行指南

**日期**: 2026-06-24  
**Repo**: <https://github.com/dejavux/immich-apps>  
**進度 SSOT**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**Gate 狀態**: [agent-prompts/GATE_STATUS.md](./agent-prompts/GATE_STATUS.md)

---

## 📍 當前狀態

| 項目 | 狀態 |
| ------ | ------ |
| **Immich Enhancement** | ✅ **結案** |
| LINE Bot | release **`6ec5aaa`**（Helm rev 34） |
| **Immich Ops** | 5a **PASS** · 5b **~80%** · Phase 1 **~90%** · Phase 4 **待停機批准** |

---

## ✅ Wave W1 — Phase 5a（PASS）

→ [BACKUP_RESTORE.md](../20_guides/infra/runbooks/BACKUP_RESTORE.md)

| 項目 | 狀態 |
| ------ | ------ |
| pg 還原演練 | ✅ 13759 = prod |
| pg 排程 2/2 | ✅ `29702580`（06-23 03:00）· `29704020`（06-24 03:00） |
| NFS data 備份 | ✅ **Complete**（`immich-data-backup-nfs-test-1782176320` · **157.8G**） |
| B2 | ⏭️ 已廢止並刪除 OP item |

---

## Wave W4 — Phase 4 SSD（待批准）

→ [STORAGE_MIGRATION.md](../20_guides/infra/runbooks/STORAGE_MIGRATION.md)

| 項目 | 狀態 |
| ------ | ------ |
| prep runbook + lama 盤點 | ✅ |
| 停機窗批准 | ⏳ **待使用者** |
| Postgres → lama NVMe | 📋 未執行 |

**建議**：選定低峰週末；依 runbook §停機步驟執行 pg 資料目錄遷移。

---

## Wave W2 — Mac library → delta NFS（Q3）

→ [MAC_LIBRARY_BACKUP.md](../20_guides/infra/runbooks/MAC_LIBRARY_BACKUP.md)

**前置**：5a PASS ✅（2026-06-24）

- [ ] delta NFS export 路徑與配額
- [ ] `local-archive` / `icloud-primary` originals rsync LaunchAgent
- [ ] 還原演練 checksum 對照

---

## Wave 5b — Grafana + 告警（進行中）

| 項目 | 狀態 |
| ------ | ------ |
| PrometheusRule `immich.rules` | ✅ |
| Grafana `immich-ops` ConfigMap | ✅ monitoring namespace |
| Caddy `grafana.3q.fi` | ✅ 改回 monitoring LoadBalancer `192.168.50.154` |
| Deep link `/d/immich-ops` | 🟡 待驗證 |
| Telegram 告警 smoke | 🟡 待驗 |

**Grafana 根因**：Caddy 曾誤指 `fuqi-asset-manager` NodePort `30300`（MetalLB pending 時的暫時方案）；`immich-ops` 在 **monitoring** Grafana ConfigMap。fuqi 專用儀表板待併入 monitoring 或獨立子網域（見 [OBSERVABILITY_ROADMAP.md](../20_guides/infra/monitoring/OBSERVABILITY_ROADMAP.md)）。

```bash
open https://grafana.3q.fi/d/immich-ops
```

---

## 驗證指令

```bash
kubectl get cronjob,jobs -n immich -l component=backup --sort-by=.metadata.creationTimestamp
kubectl get pvc immich-backup-nfs-pvc -n immich
kubectl get deploy -n immich immich-redis immich-server
kubectl get configmap grafana-dashboards -n monitoring -o jsonpath='{.data}' | jq 'keys'
```
