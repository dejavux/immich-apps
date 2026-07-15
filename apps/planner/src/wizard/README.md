# Planner Wizard API（Phase A1）

REST 前綴：`/api/planner/v1`  
認證：除 `/health` 與 `POST /auth/redeem-invite` 外，皆需 `Authorization: Bearer <api_key>`。

## 1. 兌換邀請碼

```bash
curl -sS -X POST http://localhost:3001/api/planner/v1/auth/redeem-invite \
  -H 'Content-Type: application/json' \
  -d '{"inviteCode":"FAMILY-DEMO-2026","label":"cursor-home"}'
```

回應含一次性 `apiKey`（僅此時可見明文）。

開發環境預設種子邀請碼：`FAMILY-DEMO-2026`（`PLANNER_SEED_INVITE_CODE` 可覆寫）。

## 2. Wizard 六步

```bash
API_KEY="fmp_..."
BASE="http://localhost:3001/api/planner/v1"

# 建立 session
curl -sS -X POST "$BASE/wizard/sessions" -H "Authorization: Bearer $API_KEY"

# 依序回答（step 須與目前步驟一致）
SID="<sessionId>"
curl -sS -X POST "$BASE/wizard/sessions/$SID/answer" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"step":"when","value":"暑假"}'

curl -sS -X POST "$BASE/wizard/sessions/$SID/answer" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"step":"duration","value":"4-5天"}'

curl -sS -X POST "$BASE/wizard/sessions/$SID/answer" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"step":"depart_from","value":"台北"}'

curl -sS -X POST "$BASE/wizard/sessions/$SID/answer" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"step":"must","value":"無購物,親子"}'

curl -sS -X POST "$BASE/wizard/sessions/$SID/answer" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"step":"budget","value":"2-3萬"}'

curl -sS -X POST "$BASE/wizard/sessions/$SID/answer" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"step":"review","value":"確認"}'

# 查狀態
curl -sS "$BASE/wizard/sessions/$SID" -H "Authorization: Bearer $API_KEY"

# review 確認後搜尋（打雄獅 API）
curl -sS -X POST "$BASE/wizard/sessions/$SID/search" -H "Authorization: Bearer $API_KEY"

# 回上一步
curl -sS -X POST "$BASE/wizard/sessions/$SID/back" -H "Authorization: Bearer $API_KEY"
```

## 3. 家庭資訊

```bash
curl -sS "$BASE/families/me" -H "Authorization: Bearer $API_KEY"
```

## Session 儲存

- 有 `REDIS_URL`：session 存 Redis（TTL 預設 24h）
- 無 Redis：開發／測試用 in-memory fallback

## MCP（A2）

`GET /api/planner/v1/mcp/tools` 列出 wizard、extract、compare、shortlist tool 與 REST 對照；streamable HTTP MCP 於 A3 實作。

## Tours / Shortlist（A2）

```bash
# 深抽雄獅詳情 URL
curl -sS -X POST "$BASE/tours/extract" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"url":"https://travel.liontravel.com/detail?NormGroupID=...&GroupID=..."}'

# 加入 shortlist（可直接傳 url 或 search 回傳的 summary）
curl -sS -X POST "$BASE/shortlist" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"url":"https://travel.liontravel.com/detail?..."}'

curl -sS "$BASE/shortlist" -H "Authorization: Bearer $API_KEY"

# 比較 2+ 筆（tourIds 來自 shortlist）
curl -sS -X POST "$BASE/tours/compare" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"tourIds":["lion:26JK801TWJ-T","lion:26JK915TWW-T"]}'
```

完整契約見 [api/README.md](../api/README.md)。
