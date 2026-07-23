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

建議存到本機（勿 commit）：

```bash
mkdir -p ~/.config/family-planner
chmod 700 ~/.config/family-planner
# 手動建立 credentials.json，或從 redeem 回應貼上
chmod 600 ~/.config/family-planner/credentials.json
```

## 2. ChatGPT 新增 MCP（2026-07 UI）

路徑：**Settings → Plugins → MCPs** → **Connect to a custom MCP**

> 舊版曾出現在 Settings → Apps & Connectors 或 Coding → Connections；**目前以 Plugins → MCPs 為準**。

### 表單填法

| 欄位 | 值 | 說明 |
| ------ | ----- | ------ |
| **Name** | `family-memories-planner` | 自訂名稱，對話中會顯示此 connector |
| **Type** | **Streamable HTTP** | ⚠️ **不要選 STDIO** — planner 是遠端 HTTPS 服務，不是本機 command |
| **URL**（選 Streamable HTTP 後出現） | `https://planner.3q.fi/mcp` | MCP endpoint |
| **Authentication / Headers** | `Authorization: Bearer fmp_你的_api_key` | 若表單拆成 Key / Value：Key=`Authorization`，Value=`Bearer fmp_...` |

選 **STDIO** 時會出現 `Command to launch`、`Arguments` — **那些欄位留空、不要填**；請改回 **Streamable HTTP**。

API key 可從 `~/.config/family-planner/credentials.json` 的 `keys.chatgpt-home.apiKey` 讀取。

儲存後見下方 **§2.1 在對話中啟用**。

> ChatGPT 需要 **公網 HTTPS** endpoint，無法使用 `localhost:3001`。  
> **Coding → Connections → Devices** 是 iPhone 遙控 Mac（Computer use），與 MCP 無關。

### 2.1 在對話中啟用（重要）

**Custom MCP 不會出現在輸入框 `+` → Plugins 清單裡。**

`+` 底下的 Documents / PDF / Browser / Computer 等是 **ChatGPT 內建 Plugins**；  
`family-memories-planner` 屬於 **Settings 裡設定的 Custom MCP**，啟用方式不同：

1. **Settings → Plugins → MCPs** 分頁
2. 確認 `family-memories-planner` 已儲存，且開關為 **ON** / **Enabled**
3. **開新對話**（舊對話不會自動載入新 MCP）
4. 直接輸入規劃需求；模型應能呼叫 `wizard_start` 等 tools

若 MCPs 分頁有 **「Use in chat」** 或對話標題旁的 **connector 圖示**，也可在那裡勾選。

**驗證連線成功**：在新對話問「列出 family-memories-planner 的 MCP tools」。  
正確應看到 `wizard_start`、`wizard_search`、`wizard_refine`、`extract_tour`…  
若出現 `search_memories`、`add_memory` 等 **不是** 本服務的 tools → 代表 MCP **未真正連上**（常見原因：Bearer 填錯），請改 **Headers** 方式重設（見下）。

### 2.2 Bearer 建議填法（Streamable HTTP）

| 欄位 | 建議 |
| ------ | ------ |
| Bearer token env var | **留空**（除非你真的有設 macOS 環境變數） |
| **+ Add header** | Key=`Authorization`，Value=`Bearer fmp_你的_api_key` |

「Bearer token env var」要填的是**環境變數名稱**（例如 `FAMILY_PLANNER_MCP_TOKEN`），不是 `fmp_...` 本體。

### 常見填錯

| 錯誤 | 結果 |
| ------ | ------ |
| 選了 **STDIO** 並填 `npx` / `node` | 連不到遠端 planner |
| URL 少 `/mcp` 或用了 `http://` | 404 或 TLS 失敗 |
| Token 沒加 `Bearer` 前綴 | 401 |
| 在舊對話啟用 | 有時需**新開對話**才會載入 tools |

## 3. 自然語言查詢範例

流程：**先時間 → 天數 → 目的地（可不確定）→ 出發地 → 條件 → 預算 → 搜尋**。詳見 [20_WIZARD_FLOW_V2.md](../../00_planning/planner/20_WIZARD_FLOW_V2.md)。

**範例 A（時間先、地點未定）**

```
我們 8 月想出門 5 天，台北出發，還沒決定去哪，
親子、不要購物，預算 2–3 萬。幫我搜適合的跟團行程。
```

**範例 B（搜尋後改目的地）**

```
那改搜濟州呢？其他條件一樣。
```

Agent 會依序呼叫 `wizard_start` → `wizard_answer` → `wizard_search`；改條件用 `wizard_refine`；深抽／比較用 `extract_tour` / `shortlist_add` / `compare_tours`。

## 4. 驗證

```bash
curl -sS https://planner.3q.fi/health
curl -sS https://planner.3q.fi/api/planner/v1/mcp/tools \
  -H "Authorization: Bearer fmp_你的_api_key"
```

應列出 **11** 支 tools（含 `wizard_refine`）。

在 ChatGPT 新對話可問：「列出 family-memories-planner 有哪些 tools」確認 connector 已連上。

## 疑難排解

| 症狀 | 原因 | 處理 |
| ------ | ------ | ------ |
| `dig @1.1.1.1` 有 IP、`curl` NXDOMAIN | **8.8.8.8 負快取** | 等 15–30 分鐘，或 hosts：`echo '220.132.188.225 planner.3q.fi' \| sudo tee -a /etc/hosts` |
| `dig` 有 IP、`curl` 仍失敗 | macOS DNS 快取 | `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` |
| HTTPS TLS error | Caddy / cert-manager | `kubectl -n immich get certificate planner-3q-fi-tls` 須 Ready |
| ChatGPT 連不上 MCP | 必須公網 HTTPS + Streamable HTTP | `https://planner.3q.fi/mcp`，不可用 localhost |
| 401 | Bearer 須含 `fmp_` 前綴 | 重新 redeem invite |
| 表單只有 Command / Arguments | 誤選 **STDIO** | 改選 **Streamable HTTP** |
| 在 + Plugins 找不到 planner | 自訂 MCP 不在 Plugins 清單 | 到 **Settings → Plugins → MCPs** 啟用，再**新開對話** |
| tools 是 search_memories 等 | MCP 未連上，模型臆測 | 用 Headers 設 `Authorization: Bearer fmp_...`，新對話重試 |
