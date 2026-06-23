# Immich 備份與還原 Runbook

**Phase 5a** · namespace `immich` · node `lama`  
**Manifest**：`infra-bootstrap/60_apps/immich/immich-backup-cronjobs.yaml`  
**最後更新**：2026-06-23

---

## 架構

| 元件 | 排程 | 目標 | 內容 | 前置 |
|------|------|------|------|------|
| `immich-pg-backup` | 每日 03:00 Asia/Taipei | PVC + 選用 B2 | **PostgreSQL**（metadata） | PostgreSQL secret |
| `immich-data-backup` | 週日 04:00 Asia/Taipei | B2 `immich/upload/YYYYMMDD/` | **Immich 原圖**（`/data/upload`） | **Immich-B2-Backup** |

> **Mac `.photoslibrary` 原始檔**不在上述 CronJob；見 [MAC_LIBRARY_BACKUP.md](./MAC_LIBRARY_BACKUP.md)（建議 Mac → delta NFS + 依賴 Immich/B2）。

### 1Password item `Immich-B2-Backup`（vault `Infra-Platform`）

| 欄位 | 說明 |
|------|------|
| `application-key-id` | B2 Application Key ID |
| `application-key` | B2 Application Key（僅讀） |
| `bucket` | Bucket 名稱（例 `immich-3q-backup`） |
| `endpoint` | S3 相容 endpoint（例 `https://s3.us-west-004.backblazeb2.com`） |

Operator 同步為 secret `immich-b2-backup`（namespace `immich`）。

---

## 首次設定（B2）

1. 在 Backblaze 建立 **Private** bucket（建議 lifecycle：daily 30 天、weekly 90 天）。
2. 建立 Application Key（權限：該 bucket 讀寫）。
3. 建立 1Password item 並同步 Secret（**推薦腳本**）：

```bash
cd infra-bootstrap
eval "$(op signin)"   # 若尚未登入

B2_APPLICATION_KEY_ID=... B2_APPLICATION_KEY=... B2_BUCKET=immich-3q-backup \
  bash 60_apps/immich/scripts/create-immich-b2-backup-op-item.sh

bash 60_apps/immich/scripts/bootstrap-immich-secrets.sh --wait-b2 --trigger-data-backup
```

手動替代：`kubectl apply -f 60_apps/immich/1password-items.yaml` 後等待 `immich-b2-backup` secret。

### 手動觸發 pg 備份驗證

```bash
kubectl create job -n immich --from=cronjob/immich-pg-backup immich-pg-backup-manual-$(date +%s)
kubectl logs -n immich -l backup-type=postgres -f
```

### 確認 B2 有物件

```bash
# 本機需 rclone + 相同憑證（勿 commit）
rclone lsf b2:YOUR_BUCKET/immich/pg/
```

---

## 日常驗收

```bash
# 最近 CronJob 執行
kubectl get cronjob -n immich
kubectl get jobs -n immich -l component=backup --sort-by=.metadata.creationTimestamp

# 本機 pg 備份列表（lama PVC）
kubectl exec -n immich deploy/immich-server -- ls -lh /data/backups/pg/ | tail -5
```

**通過標準**（Phase 5a gate）：

- [x] 還原演練 DB `asset` count 與 prod 同數量級（**13759**，2026-06-22）
- [ ] 連續 **2 次排程** `immich-pg-backup` Job **Complete**（非手動；目前 **1/2**，下次 03:00）
- [ ] B2 可 `list` 含日期前綴的物件（待 `Immich-B2-Backup` item）
- [ ] `immich-data-backup` Job **Complete** 至少 1 次（週日 04:00 或手動觸發）

---

## PostgreSQL 還原演練（staging / temp pod）

> **目的**：驗證 dump 可還原，作為 Phase 4 SSD 遷移硬 gate。  
> **建議**：在 `immich-restore-test` namespace 或本機 temp pod，**勿**覆寫 prod。

### 1. 選取備份檔

```bash
# 本機 PVC
BACKUP=$(kubectl exec -n immich deploy/immich-server -- \
  sh -c 'ls -t /data/backups/pg/*.sql.gz | head -1')
echo "$BACKUP"

# 或從 B2 下載（需 rclone）
```

### 2. 建立還原用 Postgres（範例）

```bash
kubectl create namespace immich-restore-test --dry-run=client -o yaml | kubectl apply -f -

kubectl run pg-restore-test -n immich-restore-test \
  --image=ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0 \
  --env="POSTGRES_USER=immich" \
  --env="POSTGRES_PASSWORD=restore-test" \
  --env="POSTGRES_DB=immich" \
  -- sleep infinity

kubectl wait -n immich-restore-test --for=condition=Ready pod/pg-restore-test --timeout=120s
```

### 3. 還原 dump

```bash
# 將備份複製到還原 pod（若在本機 PVC）
kubectl exec -n immich deploy/immich-server -- cat /data/backups/pg/immich-pg-YYYYMMDD-HHMMSS.sql.gz \
  | kubectl exec -i -n immich-restore-test pg-restore-test -- \
  sh -c 'gunzip | psql -U immich -d immich'
```

### 4. 驗證 row count

```bash
# Prod baseline
kubectl exec -n immich deploy/immich-postgres -- \
  psql -U "$(kubectl get secret immich-postgresql-credentials -n immich -o jsonpath='{.data.username}' | base64 -d)" \
  -d "$(kubectl get secret immich-postgresql-credentials -n immich -o jsonpath='{.data.database}' | base64 -d)" \
  -c "SELECT count(*) AS asset_count FROM asset;"

# Restore test
kubectl exec -n immich-restore-test pg-restore-test -- \
  psql -U immich -d immich -c "SELECT count(*) AS asset_count FROM asset;"
```

記錄：還原日期、耗時、prod vs restore `assets` count。

### 5. 清理

```bash
kubectl delete namespace immich-restore-test
```

---

## Prod 緊急還原（僅維護窗）

1. Scale down `immich-server`、`immich-machine-learning`。
2. Stop `immich-postgres`（Recreate 策略）。
3. 還原最新 `pg_dump` 至 `postgres-data` subPath（或從 dump restore 進現有 data dir）。
4. 啟動 postgres → server → ml。
5. `kubectl rollout status -n immich` + Web smoke。

詳見 Phase 4 runbook [STORAGE_MIGRATION.md](./STORAGE_MIGRATION.md) 回滾章節。

---

## 故障排除

| 症狀 | 可能原因 | 處理 |
|------|----------|------|
| pg Job `Error` | postgres 連線失敗 | `kubectl logs job/...`；確認 NetworkPolicy |
| `SKIP B2` in logs | 無 `immich-b2-backup` secret | 建立 1Password item |
| data Job `CreateContainerConfigError` | B2 secret 必填 | 先完成 B2 設定 |
| PVC 空間不足 | `/data/backups` 累積 | 清理舊本機 dump 或僅保留 B2 |

---

## 相關

- [IMMICH_v2.7.5.md](../upgrades/IMMICH_v2.7.5.md) — 手動 pg_dump 範例
- [phase-5a-backup.md](../../../00_planning/agent-prompts/phase-5a-backup.md)
- [GATE_STATUS.md](../../../00_planning/agent-prompts/GATE_STATUS.md)
