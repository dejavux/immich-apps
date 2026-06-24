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
| LINE Bot | release **`af23fe4`**（Helm rev 35） |
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

## Ops W2 — Mac library → delta NFS（進行中）

→ [MAC_LIBRARY_BACKUP.md](../20_guides/infra/runbooks/MAC_LIBRARY_BACKUP.md)

**前置**：Phase 4 ✅ · 5a PASS ✅

| 項目 | 狀態 |
| ------ | ------ |
| delta 目錄 | ✅ `ssh delta` mkdir 2026-06-24 |
| dry-run | ✅ ~146G + ~18G |
| 首輪 rsync | 🟡 **進行中**（`scripts/mac-library-backup-rsync.sh`） |
| LaunchAgent 草稿 | ✅ `scripts/mac-library-backup/com.immich.mac-library-backup.plist.example`（週六 02:00） |
| 週次自動化 | 📋 Q3 安裝 LaunchAgent |

- [x] delta NFS 路徑 SSOT
- [x] `mac-library-backup-dry-run.sh`
- [x] 本機 dry-run（local-archive **146G** · icloud-primary **18G**）
- [x] delta 遠端目錄建立
- [x] LaunchAgent plist 草稿
- [ ] 首輪 rsync Complete + 抽樣 checksum
- [ ] `launchctl load` 啟用週次排程（Q3）

**追蹤首輪 rsync**：

```bash
tail -f ~/Library/Logs/immich-mac-backup/rsync-*.log
pgrep -fl mac-library-backup-rsync
```

---

## 驗證 K8s 是否跑最新 image

```bash
# 期望 tag = git short SHA（release 後）
git -C /path/to/immich-apps rev-parse --short HEAD

kubectl get deploy immich-line-bot -n immich \
  -o jsonpath='deploy={.spec.template.spec.containers[0].image}{"\n"}'

kubectl get pods -n immich -l app.kubernetes.io/name=immich-line-bot \
  -o jsonpath='pod={.items[0].spec.containers[0].image} started={.items[0].status.startTime}{"\n"}'

helm list -n immich -f immich-line-bot
```

三者 tag 一致（例如 `af23fe4`）且 pod `STARTED` 在 deploy 之後 → 已跑最新版。

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
