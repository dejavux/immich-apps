# Family Memories Planner — ChatGPT MCP 設定

> 主對話面為 **ChatGPT MCP**（見 [FAMILY_MEMORIES_ARCHITECTURE.md](../../00_planning/FAMILY_MEMORIES_ARCHITECTURE.md)）。  
> Cursor 設定見 [MCP_SETUP.md](./MCP_SETUP.md)。

## 前置條件

1. `https://planner.3q.fi/health` 回 `{"ok":true,"service":"planner"}`
2. 已兌換家庭 API key（格式 `fmp_...`）

若 `dig` 有 IP 但 `curl` 失敗，先清本機 DNS 快取：

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

## 1. 兌換邀請碼（ChatGPT 專用 label）

```bash
curl -sS -X POST https://planner.3q.fi/api/planner/v1/auth/redeem-invite \
  -H 'Content-Type: application/json' \
  -d '{"inviteCode":"FAMILY-DEMO-2026","label":"chatgpt-home"}'
```

回應中的 `apiKey` **只顯示一次**，請立即複製保存。

## 2. ChatGPT 新增 MCP Connector

1. 開啟 [ChatGPT](https://chatgpt.com) → **Settings** → **Apps & Connectors**（或 **Connectors**）
2. **Create** / **Add connector** → 選 **Custom MCP**（或 Developer / MCP server URL）
3. 填入：

| 欄位 | 值 |
| ------ | ----- |
| Name | `family-memories-planner` |
| URL | `https://planner.3q.fi/mcp` |
| Authentication | Bearer token |
| Token | `fmp_你的_api_key` |

1. 儲存後在對話中 **啟用** 此 connector

> ChatGPT 需要 **公網 HTTPS** endpoint，無法使用 `localhost:3001`。

## 3. 自然語言查詢範例

流程：**先時間 → 再地點（可不確定）→ 再搜尋與比較**。詳見 [20_WIZARD_FLOW_V2.md](../../00_planning/planner/20_WIZARD_FLOW_V2.md)。

**範例 A（時間先、地點未定）**

```
我們 8 月想出門 5 天，台北出發，還沒決定去哪，
親子、不要購物，預算 2–3 萬。幫我搜適合的跟團行程。
```

**範例 B（時間確定後才指定地點）**

```
（問卷已填完時間與天數）
那改搜濟州呢？一樣的條件。
```

Agent 會依序呼叫 `wizard_start` → `wizard_answer` → `wizard_search` → 視需要 `extract_tour` / `shortlist_add` / `compare_tours`。

## 4. 驗證

```bash
curl -sS https://planner.3q.fi/health
curl -sS https://planner.3q.fi/api/planner/v1/mcp/tools \
  -H "Authorization: Bearer fmp_你的_api_key"
```

應列出 10 支 tools（wizard_*、extract_tour、compare_tours、shortlist_*）。

## 疑難排解

| 症狀 | 原因 | 處理 |
| ------ | ------ | ------ |
| `dig @1.1.1.1` 有 IP、`curl` NXDOMAIN | **8.8.8.8 負快取**（記錄建立前查過）；macOS 同時用 8.8.8.8 + 1.1.1.1 | 等 15–30 分鐘，或本機加 hosts：`echo '220.132.188.225 planner.3q.fi' \| sudo tee -a /etc/hosts` |
| `dig` 有 IP、`curl` 仍失敗（已加 hosts 除外） | macOS DNS 快取 | `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` |
| HTTPS TLS error | Caddy / cert-manager | `kubectl -n immich get certificate planner-3q-fi-tls` 須 Ready |
| ChatGPT 連不上 MCP | 必須公網 HTTPS | `https://planner.3q.fi/mcp`，不可用 localhost |
| 401 | Bearer 須含 `fmp_` 前綴 | 重新 redeem invite |
| 搜尋結果與口述目的地不符 | wizard v1 尚無 `destination` 步驟 | 見 [20_WIZARD_FLOW_V2.md](../../00_planning/planner/20_WIZARD_FLOW_V2.md) |
