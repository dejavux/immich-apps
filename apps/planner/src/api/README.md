# Planner REST API（Phase A2）

前綴：`/api/planner/v1`  
認證：除 `/health` 與 `POST /auth/redeem-invite` 外，皆需 `Authorization: Bearer <api_key>`。

## Auth / 家庭

- `POST /auth/redeem-invite` — 公開；兌換邀請碼
- `GET /families/me` — Bearer；含 `quota.searchUsedToday` / `extractUsedToday`

## Wizard

詳見 [wizard/README.md](../wizard/README.md)。

## Tours（A2）

### `POST /tours/extract`

Body: `{ "url": "https://travel.liontravel.com/detail?..." }`

- 支援雄獅詳情（`travelinfojson` + `daytripinfojson`）
- 可樂／鳳凰：URL 規則 + HTML title stub
- 未知 URL：僅在 `GENERIC_EXTRACT_ENABLED=true` 且設定 `GENERIC_EXTRACT_LLM_URL` 時走 generic-llm
- 回應含 `summary`（`TourSummary`）、`extractedAt`、`cached`
- Extract 結果快取 TTL：`EXTRACT_CACHE_TTL_HOURS`（預設 12h；Redis L1 + memory fallback）

```bash
curl -sS -X POST "$BASE/tours/extract" \
  -H "Authorization: Bearer $API_KEY" -H 'Content-Type: application/json' \
  -d '{"url":"https://travel.liontravel.com/detail?NormGroupID=...&GroupID=..."}'
```

### `POST /tours/compare`

Body（二擇一或混用）：

```json
{ "tourIds": ["lion:26JK801TWJ-T", "lion:26JK915TWW-T"] }
```

```json
{ "tours": [ { "...TourSummary..." }, { "...TourSummary..." } ] }
```

- `tourIds` 自家庭 shortlist 解析
- 回應含 `tours` 與 `tableMarkdown` 對照表

## Shortlist（A2）

| Method | Path | 說明 |
| ------ | ---- | ---- |
| `GET` | `/shortlist` | 列出家庭候選 |
| `POST` | `/shortlist` | body: `{ url }` 或 `{ summary }` 或 `{ tourId, summary }` |
| `DELETE` | `/shortlist/:tourId` | 移除 |

## MCP tool 對照

`GET /mcp/tools` — 含 `extract_tour`、`compare_tours`、`shortlist_*`（streamable HTTP 於 A3）。

## DB migration

- `001_a1_auth.sql` — `planner.families` / `api_keys` / `usage_daily`
- `002_a2_shortlist_extract.sql` — `planner.shortlist` / `extract_cache`
- 啟動時自動套用（`DATABASE_URL` 已設）；追蹤表 `planner.schema_migrations`
- 未設 `DATABASE_URL` 時使用 in-memory store（開發／Secret 未就緒）

### Postgres bootstrap

1. 建立 DB 與 role；connection string 寫入 1Password **`Family-Planner-DB`**（`database-url`）
2. Cluster：`deploy/helm/family-planner` 注入 `DATABASE_URL`（Secret `family-planner-db`）
3. 首次啟動跑 migration；空庫自動種子 `PLANNER_SEED_INVITE_CODE`（預設 `FAMILY-DEMO-2026`）

## 環境變數（A2 新增）

| 變數 | 預設 | 說明 |
| ---- | ---- | ---- |
| `DATABASE_URL` | — | Postgres；有值時持久化 families / shortlist / usage |
| `EXTRACT_CACHE_TTL_HOURS` | `12` | extract 快取 TTL |
| `QUOTA_EXTRACT_PER_DAY` | `20` | 每家庭每日 extract 上限 |
| `GENERIC_EXTRACT_ENABLED` | `false` | 啟用 generic-llm fallback |
| `GENERIC_EXTRACT_LLM_URL` | — | LLM extract HTTP endpoint |
