# Planner Wizard 流程 v2（重新規劃）

**狀態**: 📋 規劃（取代「鎖定濟州」示範思維）  
**日期**: 2026-07-19  
**前置**: [10_PHASE_A_IMPLEMENTATION_PLAN.md](./10_PHASE_A_IMPLEMENTATION_PLAN.md) · [FAMILY_MEMORIES_ARCHITECTURE.md](../FAMILY_MEMORIES_ARCHITECTURE.md)

---

## 設計原則

1. **先時間、後地點** — 家庭規劃通常先敲定「什麼時候有空、玩幾天」，再談想去哪。
2. **目的地不預設、不鎖定** — 濟州只是文件範例；`destination` 允許具體地名、多選、或「還沒想好」。
3. **Wizard 收斂條件，搜尋後才探索** — 問卷只收集可結構化的欄位；比較、改目的地、深抽在搜尋結果階段用 MCP tools 完成。
4. **ChatGPT 為主對話面** — 自然語言由 LLM 對應到 `wizard_answer`；步驟順序由狀態機保證，不靠 prompt 賭運氣。

---

## 現況（v1）問題

| 步驟 | 欄位 | 缺口 |
| ------ | ------ | ------ |
| 1 | `when` | ✅ 符合「先時間」 |
| 2 | `duration` | ✅ |
| 3 | `depart_from` | 出發地早於目的地討論，可接受但非核心 |
| 4 | `must` | 無 `destination`，搜尋關鍵字從 must 猜（見 `buildKeywords`）→ 結果不準 |
| 5 | `budget` | ✅ |
| 6 | `review` | ✅ |

**搜尋階段**：`keywords` 常 fallback 成「跟團旅遊」，與使用者心裡的「濟州／日本」無關。

---

## 建議流程 v2

### 階段 A — 問卷（狀態機，順序固定）

```text
when → duration → destination → depart_from → must → budget → review → [wizard_search]
```

| # | Step | 問什麼 | 允許答案 | 寫入欄位 |
| --- | ------ | -------- | ---------- | ---------- |
| 1 | `when` | 大概什麼時候出發？ | 暑假、8 月、2026-08-01~08-15 | `answers.when` |
| 2 | `duration` | 希望玩幾天？ | 4–5 天、一週 | `answers.duration` |
| 3 | **`destination`** | **想去哪裡？** | 濟州、日本、東南亞、「還沒想好」「給我建議」 | `answers.destination` |
| 4 | `depart_from` | 從哪裡出發？ | 台北／高雄／台中／不限 | `answers.depart_from` |
| 5 | `must` | 硬條件（最多 3） | 無購物、親子、保證五星 | `answers.must` |
| 6 | `budget` | 每人預算 | <2萬、2–3萬… | `answers.budget` |
| 7 | `review` | 確認卡片 | 確認／修改某步 | `readyForSearch` |

### `destination` 語意（不鎖定單一地點）

```typescript
type DestinationIntent =
  | { mode: "specific"; keywords: string[] }   // ["濟州"]、["日本","九州"]
  | { mode: "open" }                           // 還沒想好
  | { mode: "suggest"; hint?: string };         // 給建議；hint 可選「親子」「海島」
```

| 使用者說 | 解析結果 | 搜尋行為 |
| ---------- | ---------- | ---------- |
| 濟州、首爾 | `specific: ["濟州"]` | 雄獅 keywords = 濟州 |
| 日本（不限城市） | `specific: ["日本"]` | keywords = 日本 |
| 還沒想好 / 都可以 | `open` | 第一輪：依 must+budget 廣搜；回傳分組摘要（國家／標籤） |
| 推薦親子海島 | `suggest: { hint: "親子 海島" }` | keywords 組合 hint + must |

### 階段 B — 搜尋後探索（非 wizard 步驟，MCP tools）

使用者與 ChatGPT 自由對話，**不必回到 wizard 第一步**：

| 意圖 | Tool | 說明 |
| ------ | ------ | ------ |
| 看搜尋結果 | （上一步 `wizard_search` 已回） | carousel 式文字摘要 |
| 深抽某一團 | `extract_tour` | URL 或 tourId |
| 加入候選 | `shortlist_add` | |
| 比較 2+ 團 | `compare_tours` | |
| **改目的地再搜** | `wizard_refine`（新）或 `wizard_answer(destination)` + `wizard_search` | 保留 when/duration/budget，只改 destination |
| 貼別家旅行社 URL | `extract_tour` | 可樂／鳳凰 |

```text
        ┌─────────────┐
        │ wizard 問卷  │  時間 → 天數 → 目的地(可開放) → 出發地 → 條件 → 預算
        └──────┬──────┘
               ▼
        ┌─────────────┐
        │wizard_search│  雄獅跟團（keywords ← destination）
        └──────┬──────┘
               ▼
   ┌───────────────────────────┐
   │ 探索迴圈（ChatGPT 自然語言） │
   │ refine 目的地 / extract /   │
   │ shortlist / compare         │
   └───────────────────────────┘
```

---

## ChatGPT 對話範例（非鎖定濟州）

**範例 A — 時間先、地點後**

> 使用者：我們想 **8 月** 出門，大概 **5 天**，從台北出發，**還沒決定去哪**，親子、不要購物，預算 2–3 萬。  
> Agent：依序 `wizard_answer` → review 確認 → `wizard_search` → 呈現 3 個目的地分組建議。

**範例 B — 時間後才指定地點**

> （問卷已完成 when+duration）  
> 使用者：**那改搜濟州呢？**  
> Agent：`wizard_answer(destination, "濟州")` → 若已在 review 後則 `wizard_refine` → `wizard_search`。

**範例 C — 文件舊範例（僅為 demo，非預設）**

> 8 月濟州 5 天… — 與範例 A/B 相同機制，只是 `destination=濟州`。

---

## 實作優先序（Phase A+）

| 優先 | 項目 | 說明 |
| ------ | ------ | ------ |
| P0 | `destination` step + parser | 插入 `duration` 之後；schema / engine / tests |
| P0 | `buildKeywords` 改用 `destination` | 不再從 must 猜地名 |
| P1 | `wizard_refine` tool | 搜尋後只改單一欄位並重搜 |
| P1 | `open` / `suggest` 搜尋策略 | 廣搜 + 結果分組（可先簡化：多 keywords 各搜一次合併） |
| P2 | 更新 CHATGPT_MCP_SETUP / MCP_SETUP 範例 | 移除「預設濟州」語氣，改兩種範例 A/B |

**不做**：在 wizard 啟動時預填濟州；不在搜尋 API 寫死單一目的地。

---

## DNS 備註（ChatGPT / curl 連線）

`planner.3q.fi` 若 `dig @1.1.1.1` 有 IP 但 `curl` NXDOMAIN：常為 **8.8.8.8 負快取**（記錄建立前查過）。  
本機可暫用 `/etc/hosts` 或等 SOA 負快取過期；見 [CHATGPT_MCP_SETUP.md](../../20_guides/planner/CHATGPT_MCP_SETUP.md)。

---

## 驗收

- [ ] 問卷順序：when → duration → **destination** → …
- [ ] 「還沒想好」可完成 wizard 並得到合理搜尋結果
- [ ] 「改搜沖繩」不需重填時間與預算
- [ ] ChatGPT connector 端到端：自然語言 → shortlist 至少 1 筆
