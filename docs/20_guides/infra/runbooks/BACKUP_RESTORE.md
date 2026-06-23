# Immich 備份與還原 Runbook

**Phase 5a** · namespace `immich` · node `lama`  
**Manifest**：`infra-bootstrap/60_apps/immich/immich-backup-cronjobs.yaml` · `immich-backup-nfs-pvc.yaml`  
**最後更新**：2026-06-23

---

## 架構

| 元件 | 排程 | 目標 | 內容 | 前置 |
| ------ | ------ | ------ | ------ | ------ |
| `immich-pg-backup` | 每日 03:00 Asia/Taipei | PVC + NFS | **PostgreSQL** | PostgreSQL secret |
| `immich-data-backup` | 週日 04:00 Asia/Taipei | NFS `upload/YYYYMMDD/` | **Immich 原圖**（`/data/upload`） | `immich-backup-nfs-pvc` |

> **Mac `.photoslibrary`**：見 [MAC_LIBRARY_BACKUP.md](./MAC_LIBRARY_BACKUP.md)（Mac → delta NFS，與 Immich 備份互補）。

### 備份路徑

```text
lama  PVC:/data/upload/  +  /data/backups/pg/
        │ rsync（CronJob）
        ▼
NFS   /backup/immich/upload/YYYYMMDD/
      /backup/immich/pg/<timestamp>/
```

- **決策（2026-06-23）**：第二副本用 **delta NFS**；不採 Backblaze B2。
- 可選第三副本：**Google Drive**（backlog）。

---

## 首次設定（NFS）

```bash
cd infra-bootstrap/60_apps/immich
kubectl apply -f immich-backup-nfs-pvc.yaml
kubectl apply -f immich-backup-cronjobs.yaml
kubectl get pvc immich-backup-nfs-pvc -n immich   # 應 Bound
```

### 手動觸發驗證

```bash
kubectl create job -n immich --from=cronjob/immich-pg-backup immich-pg-backup-manual-$(date +%s)
kubectl create job -n immich --from=cronjob/immich-data-backup immich-data-backup-manual-$(date +%s)
kubectl logs -n immich -l backup-type=data -f
```

---

## 日常驗收

```bash
kubectl get cronjob -n immich
kubectl get jobs -n immich -l component=backup --sort-by=.metadata.creationTimestamp
kubectl exec -n immich deploy/immich-server -- ls -lh /data/backups/pg/ | tail -5
```

**Phase 5a gate**：

- [x] 還原演練 `asset` **13759** = prod
- [ ] 連續 **2 次排程** pg Job Complete（**1/2**）
- [ ] `immich-data-backup` NFS Job Complete 至少 1 次

---

## PostgreSQL 還原演練

見下方步驟（與先前相同）；dump 來源為 PVC `/data/backups/pg/`。

### 1. 選取備份檔

```bash
BACKUP=$(kubectl exec -n immich deploy/immich-server -- \
  sh -c 'ls -t /data/backups/pg/*.sql.gz | head -1')
echo "$BACKUP"
```

### 2–5. 還原測試 namespace

```bash
kubectl create namespace immich-restore-test --dry-run=client -o yaml | kubectl apply -f -
kubectl run pg-restore-test -n immich-restore-test \
  --image=ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0 \
  --env="POSTGRES_USER=immich" --env="POSTGRES_PASSWORD=restore-test" --env="POSTGRES_DB=immich" \
  -- sleep infinity
kubectl wait -n immich-restore-test --for=condition=Ready pod/pg-restore-test --timeout=120s

kubectl exec -n immich deploy/immich-server -- cat "$BACKUP" \
  | kubectl exec -i -n immich-restore-test pg-restore-test -- \
  sh -c 'gunzip | psql -U immich -d immich'

kubectl delete namespace immich-restore-test
```

---

## 故障排除

| 症狀 | 處理 |
| ------ | ------ |
| pg Job `Error` | `kubectl logs job/...`；NetworkPolicy / postgres |
| NFS PVC `Pending` | 確認 `nfs-hdd` StorageClass 與 provisioner |
| data Job 逾時 | 首次 full rsync ~115GB，可離峰手動跑 |
| PVC 空間不足 | 清理舊 `/data/backups/pg/` dump |

---

## 相關

- [phase-5a-backup.md](../../../00_planning/agent-prompts/phase-5a-backup.md)
- [GATE_STATUS.md](../../../00_planning/agent-prompts/GATE_STATUS.md)
- [STORAGE_MIGRATION.md](./STORAGE_MIGRATION.md)
