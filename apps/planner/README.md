# Family Memories Planner

行前行程規劃服務：Wizard 六步、雄獅搜尋／深抽、家庭 shortlist、MCP + REST 雙入口。

| 項目 | 值 |
| ------ | ----- |
| 服務名 | `family-memories-planner` |
| 對外 URL | `https://planner.3q.fi` |
| MCP | `https://planner.3q.fi/mcp`（Bearer `fmp_...`） |
| REST 前綴 | `/api/planner/v1` |

## 快速開始

```bash
# repo 根目錄
npm install
npm run planner:dev          # http://localhost:3001
npm run type-check:planner
npm run test:planner
```

## Cursor MCP 設定

→ **[docs/20_guides/planner/MCP_SETUP.md](../../docs/20_guides/planner/MCP_SETUP.md)**

1. `POST /auth/redeem-invite` 兌換 `FAMILY-DEMO-2026`（或家庭專用碼）
2. 將 `apiKey` 寫入 `~/.cursor/mcp.json` 的 `family-memories-planner`

## 資料持久化（Postgres）

| 變數 | 說明 |
| ------ | ------ |
| `DATABASE_URL` | Postgres connection string；**有值時**使用 `PostgresPlannerStore` |
| （未設） | 開發 fallback：`MemoryPlannerStore` + 種子邀請碼 |

啟動時自動執行 `src/db/migrations/*.sql`（`planner.schema_migrations` 追蹤版本）。

### Cluster bootstrap

1. **1Password** `Infra-Platform` → item **`Family-Planner-DB`**，欄位 `database-url`
2. Helm `deploy/helm/family-planner` 經 1Password Operator 注入 Secret `family-planner-db`
3. 部署：`make release-planner`（或 `helm upgrade --install family-planner ...`）
4. Pod 啟動 → migration → 若 `families` 為空則種子 `PLANNER_SEED_INVITE_CODE`

若 Secret 尚未就緒，Deployment 中 `DATABASE_URL` 為 `optional: true`，服務會 fallback memory store（重啟資料遺失）。

### 手動 migration（本機／維運）

```bash
export DATABASE_URL='postgresql://user:pass@host:5432/planner'
npm run planner:dev   # 啟動時自動 migrate
```

## 子目錄文件

| 路徑 | 內容 |
| ------ | ------ |
| [src/wizard/README.md](./src/wizard/README.md) | Wizard curl 範例 |
| [src/api/README.md](./src/api/README.md) | Tours / shortlist REST |
| [deploy/helm/family-planner/](../../deploy/helm/family-planner/) | K8s Helm chart |

## Deploy

- Image：`registry-internal.3q.fi/family-planner`
- Namespace：`immich`
- Ingress host：`planner.3q.fi`（TLS cert-manager）

DNS：對外需 **A 記錄** 指向 homelab 入口 IP（與 `immich.3q.fi` 相同）。

| 檢查項 | 狀態（2026-07-16） |
| ------ | ------------------ |
| Ingress `family-planner`（`immich` ns） | ✅ 已建，`planner.3q.fi` |
| Pod `/health`（cluster 內） | ✅ `{"ok":true}` |
| Route53 `planner.3q.fi` | ❌ 尚無解析（`immich.3q.fi` → `220.132.188.225`） |
| 1Password `Family-Planner-DB` | ❌ `OnePasswordItem/family-planner-db` Ready=False |
| TLS cert-manager | ⏳ 待 DNS 後完成 ACME |

建立 DNS（infra-bootstrap 慣例）：

```bash
cd infra-bootstrap/30_network/dns
./route53_manager.sh create planner.3q.fi A 220.132.188.225
```

驗證：`dig +short planner.3q.fi` → `220.132.188.225`；`curl https://planner.3q.fi/health`
