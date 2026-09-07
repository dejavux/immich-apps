# Phase A4 執行 Checklist

> **目標**：解鎖 `planner.3q.fi` 對外 MCP + Postgres 持久化  
> **最後查核**：2026-09-06

---

## 現況摘要（2026-09-06 實測）

| 項目 | 狀態 | 說明 |
| ------ | ------ | ------ |
| Route53 `planner.3q.fi` A | ✅ | `220.132.188.225`（與 `immich.3q.fi` 同 IP） |
| Caddy 反向代理 | ❌ **阻塞** | `infra-bootstrap/60_apps/caddy/Caddyfile` **無** `planner.3q.fi` → 外部 TLS handshake 失敗 |
| K8s Ingress + cert | ✅ | `planner-3q-fi-tls` Ready；cluster 內 `/health` `{"ok":true}` |
| 1Password `Family-Planner-DB` | ❌ **阻塞** | vault `Infra-Platform` **無此 item** → `OnePasswordItem/family-planner-db` Ready=False |
| `DATABASE_URL` 注入 | ❌ | Deployment 未設；目前 **MemoryPlannerStore**（restart 丟資料） |

---

## A4-1：Caddy 反向代理（P0 · ~15 min）

外部流量路徑：`Internet → Caddy (220.132.188.225) → ingress-nginx NodePort → family-planner`。

### 1.1 編輯 Caddyfile

檔案：`infra-bootstrap/60_apps/caddy/Caddyfile`

在 `immich-bot.3q.fi` 區塊旁新增（模式與 `immich-bot` 相同）：

```caddy
# planner.3q.fi：cert-manager HTTP-01（Family Memories Planner）
http://planner.3q.fi {
 handle /.well-known/acme-challenge/* {
  import ingress_nginx_http
 }
 handle {
  header Location https://{host}{uri}
  respond 301
 }
 log {
  output file /var/log/caddy/acme-challenge.log
  format json
 }
}

# Family Memories Planner — 內轉 ingress-nginx HTTP
planner.3q.fi {
 import ingress_nginx_http
 log {
  output file /var/log/caddy/planner.log
  format json
 }
}
```

### 1.2 部署 Caddy

依 repo 慣例（見 `60_apps/caddy/README.md`）reload / deploy config。

### 1.3 驗收

```bash
dig +short planner.3q.fi A
# 預期：220.132.188.225

curl -sS https://planner.3q.fi/health
# 預期：{"ok":true,"service":"planner"}

curl -sS -o /dev/null -w "%{http_code}\n" https://planner.3q.fi/mcp
# 預期：401 或 405（需 Bearer；重點是 TLS 200 級別可達）

openssl s_client -connect planner.3q.fi:443 -servername planner.3q.fi </dev/null 2>/dev/null \
  | openssl x509 -out /dev/null -subject -dates
# 預期：subject=CN=planner.3q.fi；未過期
```

---

## A4-2：Postgres + 1Password（P0 · ~30 min）

### 2.1 建立 Postgres database

在既有 Postgres instance（建議與 Immich 同 cluster 或 `postgresql1`）：

```sql
CREATE USER family_planner WITH PASSWORD '<強密碼>';
CREATE DATABASE family_planner OWNER family_planner;
GRANT ALL PRIVILEGES ON DATABASE family_planner TO family_planner;
```

Connection string 範例：

```text
postgresql://family_planner:<密碼>@<host>:5432/family_planner
```

Homelab 若 Postgres 未開 TLS，請依 PostgreSQL 連線文件關閉 SSL 驗證（常見為 URL 查詢參數 `ssl` + `mode=disable`）。

### 2.2 建立 1Password item

| 欄位 | 值 |
| ------ | ----- |
| Vault | `Infra-Platform` |
| Item 名稱 | **`Family-Planner-DB`**（名稱須完全一致） |
| 欄位 label | `database-url` |
| 欄位 value | 上列 connection string |

可選（Phase A 末）：`Family-Planner-Admin`（admin API keys）。

### 2.3 等待 Operator 同步

```bash
kubectl get onepassworditem family-planner-db -n immich -w
# 預期：READY=True

kubectl get secret family-planner-db -n immich
# 預期：存在且含 database-url

kubectl rollout restart deploy/family-planner -n immich
kubectl logs -n immich deploy/family-planner --tail=50 | rg -i 'migrate|postgres|database'
# 預期：PostgresPlannerStore、migration 成功
```

### 2.4 驗收（資料持久化）

```bash
# 1. redeem invite → 建立 family
curl -sS -X POST https://planner.3q.fi/api/planner/v1/auth/redeem-invite \
  -H 'Content-Type: application/json' \
  -d '{"inviteCode":"FAMILY-DEMO-2026","displayName":"Smoke Test"}' | jq .

# 2. rollout restart 後再以同 token 查 shortlist（應仍存在）
kubectl rollout restart deploy/family-planner -n immich
kubectl rollout status deploy/family-planner -n immich
# 用步驟 1 的 Bearer token 再呼叫 GET /api/planner/v1/shortlist
```

---

## A4-3：MCP 對外 smoke（P1 · onboarding 前）

```bash
# Cursor / ChatGPT connector 用
curl -sS https://planner.3q.fi/mcp \
  -H "Authorization: Bearer fmp_<your-token>" \
  -H "Content-Type: application/json"
```

→ 完整步驟：[MCP_SETUP.md](./MCP_SETUP.md)

---

## 故障排查速查

| 現象 | 根因 | 處理 |
| ------ | ------ | ------ |
| `dig` 有 IP 但 `curl https` TLS alert internal error | Caddy 無 host | A4-1 |
| `OnePasswordItem` Ready=False · `no items found` | 1Password 無 item | A4-2 建 item |
| Pod healthy 但 restart 後 shortlist 空 | Memory store | 確認 `DATABASE_URL` secret 注入 |
| cert-manager 卡住 | DNS 未指到 homelab | `dig` 確認 A 記錄 |

---

## 完成後更新

- [ ] `apps/planner/README.md` 檢查表改 ✅
- [ ] `docs/00_planning/planner/10_PHASE_A_IMPLEMENTATION_PLAN.md` A4 里程碑
- [ ] `docs/00_planning/PROGRESS_TRACKING.md` Phase A 狀態
