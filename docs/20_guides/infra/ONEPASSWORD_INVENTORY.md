# Immich 專案 — 1Password 憑證清單與收納策略

**最後更新**：2026-06-23

---

## 有沒有「immich-apps 專用 vault」？

**沒有獨立 vault 名稱**，但實務上有 **兩層**：

| Vault | 角色 | 誰讀 |
|-------|------|------|
| **`Infra-Apps`** | **人類／本機 dev SSOT** | `op` CLI、`load-env-from-op.sh`、建立 item 腳本 |
| **`Infra-Platform`** | **K8s `immich` namespace Operator SSOT** | 1Password Connect（immich namespace **僅授權此 vault**） |

**規則**：在 Mac 上建立／輪換憑證 → 放 `Infra-Apps`（或直接在 `Infra-Platform`）→ 若 K8s 要用，須在 `Infra-Platform` 有同名 item（或跑 `scripts/sync-op-items-infra-platform.sh`）。

---

## Item 清單（依用途）

### A. 應用／本機 dev（`Infra-Apps` → 同步至 `Infra-Platform`）

| Item | 欄位 | 用途 | 建立腳本 | K8s Secret |
|------|------|------|----------|------------|
| **Immich-LINE-Bot** | channel-id, channel-secret, access-token, bot-id | LINE webhook | `scripts/create-line-bot-op-item.sh` | `immich-line-bot-secrets`（Helm） |
| **Immich-API-Key** | api-key | Immich API、photo-sync、LINE bot | `scripts/create-immich-api-key-op-item.sh` | `immich-api-key`（Helm） |

**同步**：`./scripts/sync-op-items-infra-platform.sh`（LINE + API Key → `Infra-Platform`）

**本機載入**（不寫檔）：

```bash
eval "$(./scripts/dev/load-env-from-op.sh)"   # 預設 vault Infra-Apps
```

**LaunchAgent 減少彈窗**：`scripts/photo-sync/bootstrap-credentials.sh` → `photo-sync.env`（本機檔，勿 commit）

---

### B. 基礎設施（直接在 `Infra-Platform`）

| Item | 欄位 | 用途 | 建立腳本 | K8s Secret |
|------|------|------|----------|------------|
| **Immich-PostgreSQL** | username, password, database, hostname… | Immich DB | （手動／既有） | `immich-postgresql-credentials` |
| **Immich-B2-Backup** | application-key-id, application-key, bucket, endpoint | pg + upload 異地備份 | `infra-bootstrap/60_apps/immich/scripts/create-immich-b2-backup-op-item.sh` | `immich-b2-backup` |
| **Immich-Redis** | password | Valkey requirepass | `infra-bootstrap/60_apps/immich/scripts/create-immich-redis-op-item.sh` | `immich-redis-credentials` |

Manifest：`infra-bootstrap/60_apps/immich/1password-items.yaml`

---

### C. 已棄用／不需要

| Item | 說明 |
|------|------|
| **OpenAI-API-Key** | V1.1 改叢集 Qwen；**不需**建立 |

---

### D. 相關但非 immich-apps repo 管理

| Item | Vault | 用途 |
|------|-------|------|
| **Monitoring-Telegram-Bot** | Infra-CI（SSOT）+ Grid Bot V3 Keys（Operator） | 告警 Telegram |
| **GitHub-Tekton-Webhook-Secret** | Infra-CI | CI webhook |

---

## 收納建議

```text
Infra-Apps          ← 人類建立、本機 dev、photo-sync
    │ sync-op-items-infra-platform.sh（LINE + API Key）
    ▼
Infra-Platform      ← immich namespace K8s Operator 唯一可讀
    ├── Immich-PostgreSQL
    ├── Immich-LINE-Bot
    ├── Immich-API-Key
    ├── Immich-B2-Backup
    └── Immich-Redis

Infra-CI            ← 監控／CI（與 immich 分離）
```

1. **新 Immich 憑證**：若只給 K8s → 直接建 `Infra-Platform`；若本機也要用 → 建 `Infra-Apps` + 同步腳本或雙寫。
2. **輪換**：改 OP item → Operator 自動同步 Secret → `kubectl rollout restart` 對應 deployment。
3. **勿**在 repo commit `.env`、`photo-sync.env`、或 `op read` 輸出。
4. **命名**：維持 `Immich-*` 前綴，與 `1password-items.yaml` / Helm `itemPath` 一致。

---

## 相關

- [K8S_DEPLOYMENT.md](./K8S_DEPLOYMENT.md)
- [BACKUP_RESTORE.md](./runbooks/BACKUP_RESTORE.md)
- [B2_BACKBLAZE_SETUP.md](./runbooks/B2_BACKBLAZE_SETUP.md)
