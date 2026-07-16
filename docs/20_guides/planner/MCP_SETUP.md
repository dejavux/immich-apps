# Family Memories Planner — Cursor MCP 設定

> Phase A4 · 家人 onboarding · `family-memories-planner`

服務對外：`https://planner.3q.fi`（本機開發：`http://localhost:3001`）

---

## 1. 兌換邀請碼（取得 API Key）

每位家人先兌換一次邀請碼，取得 **僅顯示一次** 的 `apiKey`（格式 `fmp_...`）。

### 公開邀請碼（Demo）

| 邀請碼 | 用途 | 備註 |
| ------ | ---- | ---- |
| `FAMILY-DEMO-2026` | 開發／試用 | 預設種子；`invite_max_uses=5` |

### 家庭專用邀請碼

Admin 在 Postgres `planner.families` 新增一筆（或日後 `planner:seed-invite` CLI）：

```sql
INSERT INTO planner.families (id, name, invite_code, invite_max_uses)
VALUES (gen_random_uuid(), '王家', 'WANG-2026-JEJU', 3);
```

### 兌換 REST

```bash
# 正式環境
curl -sS -X POST https://planner.3q.fi/api/planner/v1/auth/redeem-invite \
  -H 'Content-Type: application/json' \
  -d '{"inviteCode":"FAMILY-DEMO-2026","label":"cursor-home"}'

# 本機
curl -sS -X POST http://localhost:3001/api/planner/v1/auth/redeem-invite \
  -H 'Content-Type: application/json' \
  -d '{"inviteCode":"FAMILY-DEMO-2026","label":"cursor-home"}'
```

回應範例：

```json
{
  "ok": true,
  "apiKey": "fmp_xxxxxxxx",
  "family": { "id": "...", "name": "Demo Family" }
}
```

**請立即複製 `apiKey`**，之後無法再查詢明文。

---

## 2. Cursor `~/.cursor/mcp.json`

在 `mcpServers` 加入 `family-memories-planner`：

```json
{
  "mcpServers": {
    "family-memories-planner": {
      "url": "https://planner.3q.fi/mcp",
      "headers": {
        "Authorization": "Bearer fmp_你的_api_key"
      }
    }
  }
}
```

### 本機 fallback

開發時可改指向本機（需先 `npm run planner:dev`）：

```json
{
  "mcpServers": {
    "family-memories-planner": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer fmp_你的_api_key"
      }
    }
  }
}
```

儲存後 **重啟 Cursor** 或重新載入 MCP。Settings → MCP 應顯示 `family-memories-planner` 已連線。

驗證：

```bash
curl -sS https://planner.3q.fi/health
curl -sS https://planner.3q.fi/api/planner/v1/mcp/tools \
  -H "Authorization: Bearer fmp_你的_api_key"
```

---

## 3. MCP Tools（10 支）

| Tool | 說明 |
| ------ | ------ |
| `wizard_start` | 建立 wizard session，回傳第一步 prompt |
| `wizard_status` | 查詢 session 目前步驟與已填答案 |
| `wizard_answer` | 回答目前步驟並推進狀態機 |
| `wizard_back` | 回上一步 |
| `wizard_search` | review 確認後搜尋雄獅跟團 |
| `extract_tour` | 從旅行社 URL 深抽完整 TourSummary |
| `compare_tours` | 2–N 筆行程對照（shortlist id 或 inline summaries） |
| `shortlist_add` | 加入家庭候選行程 |
| `shortlist_list` | 列出家庭 shortlist |
| `shortlist_remove` | 從 shortlist 移除指定 tourId |

REST 對照：`GET /api/planner/v1/mcp/tools`（需 Bearer）。

---

## 4. 實戰範例：8 月濟州 5 天

在 Cursor Agent 對話中（已連 MCP），可用自然語言驅動 wizard：

1. **「用 family-memories-planner 開始規劃濟州行程」** → `wizard_start`
2. **when**：`8月` 或 `暑假`
3. **duration**：`5天` 或 `4-5天`
4. **depart_from**：`台北`
5. **must**：`無購物,親子`
6. **budget**：`2-3萬`
7. **review**：`確認` → `wizard_search` 搜雄獅
8. 選一筆詳情 URL → `extract_tour` 深抽
9. `shortlist_add` 加入候選；多筆後 `compare_tours` 對照
10. `shortlist_list` 確認家庭 shortlist 已持久化（Postgres 重啟後仍可列出）

等價 REST 流程見 [apps/planner/src/wizard/README.md](../../../apps/planner/src/wizard/README.md)。

---

## 5. 疑難排解

| 症狀 | 檢查 |
| ------ | ------ |
| MCP 離線 | `curl https://planner.3q.fi/health`；DNS 是否指向 `220.132.188.225`（與 immich 同入口） |
| 401 Unauthorized | `Authorization: Bearer` 是否含 `fmp_` 前綴；key 是否已 revoke |
| 403 invite | 邀請碼錯誤或 `invite_max_uses` 用盡 |
| 429 quota | 每日 search/extract 上限（預設 30/20） |
| 本機連不上 | `PLANNER_AUTOSTART=0` 未設、`PORT=3001`、先 redeem 本機 invite |

---

## 相關文件

- [apps/planner/README.md](../../../apps/planner/README.md) — 服務總覽、Postgres bootstrap
- [apps/planner/src/api/README.md](../../../apps/planner/src/api/README.md) — REST 契約
- [10_PHASE_A_IMPLEMENTATION_PLAN.md](../../00_planning/planner/10_PHASE_A_IMPLEMENTATION_PLAN.md) — Phase A 驗收
