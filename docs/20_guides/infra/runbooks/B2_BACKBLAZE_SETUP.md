# Backblaze B2 — Immich 備份設定 Checklist

**Phase 5a** · bucket + Application Key + 1Password · **最後更新**：2026-06-23

---

## 目標架構（3-2-1）

| 副本 | 位置 | 內容 |
|------|------|------|
| 1 | lama PVC `/data/upload` + `/data/backups/pg/` | Immich 線上資料 |
| 2 | B2 `immich/upload/` + `immich/pg/` | 異地（Backblaze） |
| 3 | （建議）Mac `photoslibrary` → delta NFS | 原始檔 SSOT 本機冷備 |

B2 負責 **異地**；不取代 Mac 原始 library 備份（見 [MAC_LIBRARY_BACKUP.md](./MAC_LIBRARY_BACKUP.md)）。

---

## Step 1 — 建立 Bucket

1. 登入 [Backblaze B2](https://secure.backblaze.com/b2_buckets.htm)
2. **Create a Bucket**
   - **Name**：`immich-3q-backup`（全域唯一；可自訂，與下方 `B2_BUCKET` 一致）
   - **Files in Bucket are**：**Private**
   - **Default Encryption**：Server-Side Encryption **Enabled**（建議）
   - **Object Lock**：Disabled（除非合規需要 WORM）
3. 記下 **Bucket ID**（建立 Application Key 時可選 bucket 限制）

---

## Step 2 — Lifecycle Rules（建議）

在 bucket → **Lifecycle Settings**：

| Rule | Prefix | Action | 保留 |
|------|--------|--------|------|
| pg daily | `immich/pg/` | Keep only last **30** versions / days | 30 天 |
| upload weekly | `immich/upload/` | Keep only last **12** versions | ~3 個月週備份 |

> B2 lifecycle 以「版本」或「天數」設定；pg 路徑含時間戳子目錄，建議 **30 天** 刪除舊版。  
> `upload` 為週 sync，保留 **12** 份 ≈ 3 個月。

若 UI 不支援 prefix 分開，可統一 **90 天** Delete after N days on `immich/` prefix。

---

## Step 3 — Application Key（最小權限）

**App Keys** → **Add a New Application Key**：

| 欄位 | 建議值 |
|------|--------|
| Name of Key | `immich-k8s-backup` |
| Allow access to Bucket(s) | **Only one bucket** → `immich-3q-backup` |
| Type of Access | **Read and Write** |
| Allow List All Bucket Names | **No** |
| Files in Bucket Read | **Yes** |
| Files in Bucket Write | **Yes** |
| Files in Bucket Delete | **Yes**（lifecycle / rclone 覆寫需要） |
| Share Files | **No** |

建立後 **立即複製** `keyID` + `applicationKey`（只顯示一次）。

**不要**使用 Master Application Key。

---

## Step 4 — 1Password + K8s

```bash
cd /Users/light0/DEV/infra/infra-bootstrap
eval "$(op signin)"

export B2_APPLICATION_KEY_ID='<keyID>'
export B2_APPLICATION_KEY='<applicationKey>'
export B2_BUCKET='immich-3q-backup'
export B2_ENDPOINT='https://s3.us-west-004.backblazeb2.com'   # 依 bucket region

bash 60_apps/immich/scripts/create-immich-b2-backup-op-item.sh
bash 60_apps/immich/scripts/bootstrap-immich-secrets.sh --wait-b2 --trigger-data-backup
```

驗證：

```bash
kubectl get secret immich-b2-backup -n immich
kubectl logs -n immich -l backup-type=postgres --tail=5    # 應見 B2 upload complete
# 手動 pg（可選）
kubectl create job -n immich --from=cronjob/immich-pg-backup immich-pg-b2-test-$(date +%s)
```

本機 list（需 rclone）：

```bash
eval "$(op signin)"
KEY_ID=$(op read op://Infra-Platform/Immich-B2-Backup/application-key-id)
KEY=$(op read op://Infra-Platform/Immich-B2-Backup/application-key)
BUCKET=$(op read op://Infra-Platform/Immich-B2-Backup/bucket)
RCLONE_CONFIG_B2_TYPE=b2 RCLONE_CONFIG_B2_ACCOUNT="$KEY_ID" RCLONE_CONFIG_B2_KEY="$KEY" \
  rclone lsf "b2:${BUCKET}/immich/"
```

---

## Step 5 — Phase 5a Gate 驗收

- [ ] `immich-b2-backup` secret 存在
- [ ] pg Job log：`B2 upload complete`
- [ ] `immich-data-backup` Job **Complete**（週日或 `--trigger-data-backup`）
- [ ] `rclone lsf` 可見 `immich/pg/`、`immich/upload/` 前綴
- [ ] 連續 **2 次排程** `immich-pg-backup` Success（非手動）

---

## 故障排除

| 症狀 | 處理 |
|------|------|
| `401` / unauthorized | Key 過期或 bucket 名錯；重建 Application Key |
| `SKIP B2` in pg logs | secret 未同步；檢查 Operator + `Infra-Platform` item |
| data Job `CreateContainerConfigError` | `immich-b2-backup` 必填（非 optional） |
| 上傳極慢 | 調整 CronJob `resources`；首次 full sync 可離峰手動跑 |

---

## 相關

- [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)
- [ONEPASSWORD_INVENTORY.md](../ONEPASSWORD_INVENTORY.md)
