# Family Memories Planner — Cursor MCP 設定

> Phase A4 · 家人 onboarding · `family-memories-planner`  
> ChatGPT 設定見 [CHATGPT_MCP_SETUP.md](./CHATGPT_MCP_SETUP.md)。

服務對外：`https://planner.3q.fi`（本機開發：`http://localhost:3001`）

---

## 1. 兌換邀請碼（取得 API Key）

每位家人先兌換一次邀請碼，取得 **僅顯示一次** 的 `apiKey`（格式 `fmp_...`）。

### 公開邀請碼（Demo）

| 邀請碼 | 用途 | 備註 |
| ------ | ---- | ---- |
| `FAMILY-DEMO-2026` | 開發／試用 | 預設種子；`invite_max_uses=5` |

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

**請立即複製 `apiKey`**，之後無法再查詢明文。可存於 `~/.config/family-planner/credentials.json`（`chmod 600`）。

---

## 2. 設定 `~/.cursor/mcp.json`

在 `mcpServers` 加入（或合併）`family-memories-planner`：

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

---

## 3. 在 Cursor 啟用與確認連線

1. **儲存** `~/.cursor/mcp.json`
2. **重啟 Cursor**，或 **Cmd+Shift+P** → `MCP: List Servers` / 開啟 **Settings → MCP**
3. 確認 `family-memories-planner` 狀態為 **Connected**（綠點）
4. 若離線：點 **Refresh**；仍失敗則檢查 `curl https://planner.3q.fi/health`

驗證（終端機）：

```bash
curl -sS https://planner.3q.fi/api/planner/v1/mcp/tools \
  -H "Authorization: Bearer fmp_你的_api_key"
```

應回 11 支 tools。

---

## 4. 在 Cursor 裡怎麼用

### 開 Agent 對話

1. 開新 **Agent** 對話（Composer / Agent 模式）
2. MCP tools 會自動提供給 Agent — 不必手動 `@` 每支 tool
3. 用自然語言描述需求即可；Agent 會呼叫 `wizard_*`、`extract_tour` 等

### 建議開場

```
用 family-memories-planner 幫我規劃行程：
8 月、5 天、台北出發、還沒決定去哪、親子、不要購物、預算 2-3 萬。
走完 wizard 並搜尋，把結果摘要給我。
```

### Wizard v2 步驟（Agent 會依序 answer）

| 步驟 | 範例回答 |
| ------ | --------- |
| when | `8月` / `暑假` |
| duration | `5天` |
| **destination** | `濟州` / `還沒想好` / `推薦親子海島` |
| depart_from | `台北` |
| must | `無購物,親子` |
| budget | `2-3萬` |
| review | `確認` → `wizard_search` |

搜尋後改單一條件：

```
用 wizard_refine 把目的地改成沖繩，其他不變，重新搜尋。
```

### 常用後續指令

| 意圖 | 說法範例 |
| ------ | --------- |
| 深抽行程 | 「從這個雄獅 URL 抽出完整行程」 |
| 加入候選 | 「加入 shortlist」 |
| 比較 | 「比較 shortlist 裡前兩團」 |
| 查 shortlist | 「列出目前 shortlist」 |

---

## 5. MCP Tools（11 支）

| Tool | 說明 |
| ------ | ------ |
| `wizard_start` | 建立 wizard session |
| `wizard_status` | 查詢 session 步驟與答案 |
| `wizard_answer` | 回答目前步驟 |
| `wizard_back` | 回上一步 |
| `wizard_search` | review 確認後搜尋雄獅 |
| `wizard_refine` | 搜尋後只改單一欄位並重搜 |
| `extract_tour` | 從 URL 深抽 TourSummary |
| `compare_tours` | 2–N 筆行程對照 |
| `shortlist_add` | 加入候選 |
| `shortlist_list` | 列出 shortlist |
| `shortlist_remove` | 移除候選 |

REST 對照：`GET /api/planner/v1/mcp/tools`（需 Bearer）。

---

## 6. 疑難排解

| 症狀 | 檢查 |
| ------ | ------ |
| MCP 離線 | `curl https://planner.3q.fi/health`；DNS / hosts |
| 401 Unauthorized | `Bearer fmp_...` 前綴；key 是否 revoke |
| Agent 不呼叫 tools | 確認 Agent 模式；新開對話；MCP 綠點 |
| 本機連不上 | `npm run planner:dev`、`PORT=3001`、本機 redeem |

---

## 相關文件

- [CHATGPT_MCP_SETUP.md](./CHATGPT_MCP_SETUP.md) — ChatGPT Plugins → MCPs
- [20_WIZARD_FLOW_V2.md](../../00_planning/planner/20_WIZARD_FLOW_V2.md) — Wizard 流程
- [apps/planner/README.md](../../../apps/planner/README.md) — 服務總覽
