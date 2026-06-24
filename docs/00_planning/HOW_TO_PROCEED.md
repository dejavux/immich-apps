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
| **Immich Ops** | 5a **PASS** · 5b **~95%** · Phase 4 ✅ **COMPLETE** |

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

## Wave W4 — Phase 4 SSD ✅ COMPLETE（2026-06-24）

Postgres 已遷至 lama NVMe `/nvme/immich-postgres`；upload 仍 HDD。詳見 [STORAGE_MIGRATION.md](../20_guides/infra/runbooks/STORAGE_MIGRATION.md)。

**驗收**：`asset` **13763** · ping **pong** · 停機 ~5 分鐘。

---

## Ops W2 — Mac library → delta NFS（Q3）

→ [MAC_LIBRARY_BACKUP.md](../20_guides/infra/runbooks/MAC_LIBRARY_BACKUP.md)

**前置**：Phase 4 ✅ · 5a PASS ✅

- **可現在開始 prep**：delta NFS export 路徑／配額、rsync dry-run、LaunchAgent 草稿
- **完整自動化 rsync** 建議 **Q3**（一輪 pg/NFS 備份驗證後）

- [ ] delta NFS export 路徑與配額
- [ ] `local-archive` / `icloud-primary` originals rsync LaunchAgent
- [ ] 還原演練 checksum 對照

---

## Wave 5b — Grafana + 告警（~95%）

| 項目 | 狀態 |
| ------ | ------ |
| PrometheusRule `immich.rules` | ✅ |
| Grafana `immich-ops` ConfigMap | ✅ monitoring namespace |
| Caddy `grafana.3q.fi` | ✅ 改回 monitoring LoadBalancer `192.168.50.154` |
| Prometheus RBAC（kube-state-metrics scrape） | ✅ `prometheus-monitoring` ClusterRoleBinding |
| Deep link `/d/immich-ops` | ✅ kube + HTTP panels 有資料（2026-06-24） |
| Telegram 告警 smoke | 🟡 已重送 3 條（待使用者確認） |

**Grafana 根因（2026-06-24）**：`monitoring/prometheus` SA 未綁定 ClusterRole（`prometheus` binding 僅指向 `grid-bot-shared-services`）→ kube-state-metrics / kubernetes-pods 無法 scrape → 全板 No data。已新增 `prometheus-monitoring` binding；HTTP panel 改用 Immich OTEL metric 名稱（`http_server_*`）。

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
