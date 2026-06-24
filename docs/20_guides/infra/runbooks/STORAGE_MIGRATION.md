# Immich Postgres / 縮圖遷移至 NVMe SSD

**Phase 4** · **停機窗已批准 2026-06-24**（執行待排程）  
**最後更新**：2026-06-24

---

## 批准紀錄

| 項目 | 狀態 |
| ------ | ------ |
| Phase 5a gate | ✅ PASS（2026-06-24） |
| 停機窗批准 | ✅ **2026-06-24**（使用者確認） |
| 執行 | 📋 **待排程**（建議週末低峰 30–60 分鐘；**2026-06-24 評估：尚未 ready 立即執行**） |

### 執行就緒檢查（2026-06-24）

| 項目 | 狀態 | 備註 |
| ------ | ------ | ------ |
| Phase 5a gate | ✅ | pg 2/2 · NFS test Complete |
| 停機窗批准 | ✅ | 2026-06-24 |
| lama NVMe 目標目錄 | ✅ | `/nvme/immich-postgres` 已建立（2026-06-24 · `chown 999:999`） |
| postgres 現況 | HDD | `immich-local-pv` → `/mnt/immich` · subPath `postgres-data`（~470M） |
| postgres Deployment | ✅ | rollback + manifest 補 `nvidia.com/gpu` toleration · `Recreate` strategy（2026-06-24） |
| 5b Telegram smoke | 🟡 | 2026-06-24 03:22Z 重送 3 條 · 待使用者確認 |
| Grafana immich-ops | ✅ | server/postgres Up · backup age 正常 |

**結論**：NVMe prep 與 postgres rollout **已完成**（2026-06-24）。**排定週末低峰窗**執行 §4-3…4-6。

---

## 目標

將 **postgres-data**（與可選 **thumbs**）從 HDD `/mnt/immich` 遷到 lama NVMe，降低查詢延遲。  
**不**搬移 `/data/upload`（~115GB 留 HDD）。

---

## 4-prep-A：lama 儲存盤點（2026-06-22 實測）

```bash
ssh lama 'df -h /mnt/immich; lsblk'
```

| 裝置 | 大小 | 掛載 | 用途 |
| ------ | ------ | ------ | ------ |
| `sda2` | 1T | `/mnt/immich` | **現況** Immich PVC hostPath（HDD） |
| `nvme0n1p3` → LVM | ~928G | `/` | 系統根目錄（NVMe，**有空間**） |
| `sda1` | ~931G | PhotoPrism storage | 無關 |

**結論**：

- Postgres data + thumbs 合計遠小於 NVMe 可用空間（根分區 ~714G avail on `/` 同節點）。
- **建議目標路徑**（待遷移前確認）：`/var/lib/immich-postgres` 或專用 mount `/nvme/immich-postgres`。
- 遷移前應建立專用目錄 + bind mount，避免與系統根分區競爭。

### 遷移前空間規劃

```bash
# 在 lama 上
sudo du -sh /mnt/immich/postgres-data /mnt/immich/thumbs 2>/dev/null
df -h /
```

預估：postgres ~數 GB；thumbs ~3GB（見 [STORAGE_AUDIT.md](../../photo-sync/runbooks/STORAGE_AUDIT.md)）。

---

## 4-prep-B：遷移 Runbook（執行日序列）

> **硬依賴**：Phase 5a 還原演練 PASS · 最新 pg_dump 可用 · 維護窗 30–60 分鐘

### 4-1 維護公告 + 最終備份

```bash
kubectl create job -n immich --from=cronjob/immich-pg-backup immich-pg-pre-migrate-$(date +%s)
kubectl wait -n immich --for=condition=complete job -l backup-type=postgres --timeout=3600s
```

### 4-2 Scale down 應用

```bash
kubectl scale deployment immich-server immich-machine-learning -n immich --replicas=0
kubectl wait -n immich --for=delete pod -l app=immich-server --timeout=300s
```

### 4-3 Stop postgres · rsync 資料

```bash
kubectl scale deployment immich-postgres -n immich --replicas=0
kubectl wait -n immich --for=delete pod -l app=immich-postgres --timeout=300s

# 在 lama 上（hostPath 來源）
sudo mkdir -p /nvme/immich-postgres
sudo rsync -aH /mnt/immich/postgres-data/ /nvme/immich-postgres/
sudo du -sh /mnt/immich/postgres-data /nvme/immich-postgres
```

可選 thumbs：

```bash
sudo rsync -aH /mnt/immich/thumbs/ /nvme/immich-thumbs/
```

### 4-4 更新 PV / volumeMount

修改 `infra-bootstrap/60_apps/immich/immich-local-pv.yaml` 或 postgres `hostPath` / `subPath`：

- **僅**變更 postgres（與可選 thumbs）路徑
- **勿**變更 upload 路徑

範例（hostPath 新目錄）：

```yaml
# postgres volume — 遷移後
hostPath:
  path: /nvme/immich-postgres
  type: Directory
```

### 4-5 啟動服務

```bash
kubectl apply -f immich-local-pv.yaml immich-deployment.yaml
kubectl scale deployment immich-postgres -n immich --replicas=1
kubectl rollout status deployment/immich-postgres -n immich
kubectl scale deployment immich-server immich-machine-learning -n immich --replicas=1
kubectl rollout status deployment/immich-server -n immich
```

### 4-6 驗收

```bash
kubectl get pods -n immich
kubectl exec -n immich deploy/immich-postgres -- psql -U ... -c "SELECT count(*) FROM assets;"
curl -fsS https://immich.3q.fi/api/server/ping
# LINE bot 上傳 + 搜尋 smoke
```

記錄遷移前後簡單查詢延遲（aspirational -50%）。

---

## 回滾

1. Scale down server/ml/postgres。
2. 還原 hostPath 至 `/mnt/immich/postgres-data`（舊 rsync 快照或 Phase 5a dump restore）。
3. 重啟 postgres → server → ml。
4. 若 DB 損壞：依 [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) 從最新 dump 還原。

---

## 禁止

- Phase 5a 還原演練未 PASS 時執行停機遷移
- 遷移窗內執行 `immich-sync.sh` / tier bulk
- 未經使用者確認的維護窗

---

## 相關

- [STORAGE_AUDIT.md](../../photo-sync/runbooks/STORAGE_AUDIT.md)
- [phase-4-storage-ssd.md](../../../00_planning/agent-prompts/phase-4-storage-ssd.md)
- [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)
