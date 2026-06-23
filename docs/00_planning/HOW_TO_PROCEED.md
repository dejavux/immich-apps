# 如何進行 — Immich Apps 執行指南

**日期**: 2026-06-23  
**Repo**: <https://github.com/dejavux/immich-apps>  
**進度 SSOT**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)  
**Gate 狀態**: [agent-prompts/GATE_STATUS.md](./agent-prompts/GATE_STATUS.md)

---

## 📍 當前狀態

| 項目 | 狀態 |
| ------ | ------ |
| **Immich Enhancement** | ✅ **結案** |
| LINE Bot | release **`6ec5aaa`**（Helm rev 34） |
| **Immich Ops** | 5a **~90%** · 5b **~70%** · Phase 1 **~90%** |

---

## 🎯 Wave W1 — Phase 5a（進行中）

→ [BACKUP_RESTORE.md](../20_guides/infra/runbooks/BACKUP_RESTORE.md)

| 項目 | 狀態 |
| ------ | ------ |
| pg 還原演練 | ✅ 13759 = prod |
| pg 排程 2/2 | 🟡 **1/2**（下次 06-24 03:00） |
| NFS data 備份 | ✅ **Complete**（`immich-data-backup-nfs-test-1782176320` · **157.8G** · 7h34m） |
| B2 | ⏭️ 已廢止並刪除 OP item |

**追蹤 pg 排程**：

```bash
kubectl get cronjob immich-pg-backup -n immich
kubectl get jobs -n immich -l component=backup --sort-by=.metadata.creationTimestamp
```

---

## 後續 Wave

| Wave | 內容 | 條件 |
| ------ | ------ | ------ |
| **4** | Postgres → NVMe 停機遷移 | 5a PASS + 批准 |
| **W2** | Mac library → delta NFS | 5a PASS 後 Q3 |

**5a PASS**：06-24 03:00 pg 排程 Success（NFS ✅）。

---

## Wave 5b — Grafana（進行中）

| 項目 | 狀態 |
| ------ | ------ |
| ConfigMap apply + rollout | ✅ 2026-06-23 |
| Deep link `/d/immich-ops` | 🟡 待驗證 |
| Telegram 告警 smoke | 🟡 待驗 |

```bash
open https://grafana.3q.fi/d/immich-ops
```

---

## 驗證指令

```bash
kubectl get cronjob,jobs -n immich -l component=backup
kubectl get pvc immich-backup-nfs-pvc -n immich
kubectl get deploy -n immich immich-redis immich-server
```
