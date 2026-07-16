# Family Memories — Planner Phase A 實作計畫

**狀態**: 🟡 進行中（A0–A3 ✅ · A4 收尾）  
**優先級**: P1（Family Memories 主軌）  
**前置**: [FAMILY_MEMORIES_ARCHITECTURE.md](../FAMILY_MEMORIES_ARCHITECTURE.md)（架構 SSOT）· [scripts/trip/README.md](../../../scripts/trip/README.md)（雄獅探針）  
**最後更新**: 2026-07-16

---

## 問題陳述

| 現況 | 痛點 |
| ------ | ------ |
| 家庭行前規劃分散在 LINE 對話、旅行社官網、試算表 | 無法持久化偏好、shortlist、比較結果 |
| `scripts/trip/` 已有雄獅搜尋／摘要 prototype | 僅 CLI、無 auth、無 wizard、無 MCP |
| LINE Bot 擅長照片上傳與搜圖 | 不適合多輪行程問卷與長文比較 |
| ChatGPT / Cursor 可當規劃面 | 缺穩定 Platform API 與家庭 workspace 契約 |

**目標**：交付 **`apps/planner`** 白名單服務——有狀態 wizard、雄獅跟團搜尋、可樂／鳳凰 URL 深抽、家庭 shortlist；**MCP 與 REST 共用同一 API**；家人／親友以邀請碼 + API key 使用。

---

## Phase A 目標

1. **Wizard**：六步問卷（`when` → `duration` → `depart_from` → `must` → `budget` → `review`），模糊口語解析；預設 `tourType=group`。
2. **搜尋**：review 通過後 `wizard_search`，Phase A 僅雄獅跟團（`grouplistinfojson`）。
3. **深抽**：`extract_tour` 支援雄獅詳情、可樂／鳳凰 URL；未知 URL 可選 LLM fallback（feature-flag）。
4. **Shortlist**：家庭共用候補清單（`shortlist_add` / `shortlist_list` / `shortlist_remove`）。
5. **Auth**：`Family` + `invite_code` → `api_key`（Bearer）；每日 search／extract 硬上限。
6. **Client**：Streamable HTTP MCP（`family-memories-planner`）+ REST `/api/planner/v1/*` 同一 handler。
7. **部署**：`deploy/helm/family-planner`；Redis session／cache、Postgres 持久化。
8. **觀測**：request、adapter 成敗、extract latency 基本 metrics。

---

## Phase A 非目標

- **不做** `trip-core` 命名或獨立 repo；服務名固定 **`planner`**。
- **不做** 可樂／鳳凰完整搜尋 API（僅 URL extract）。
- **不做** 公開註冊、計費、下單、即時庫存保證。
- **不做** map／timeline Web UI、`apps/recall`（Phase C）。
- **不做** LINE 與 planner 深度合併（僅 auth 契約預留、共用 Redis／Postgres 慣例）。
- **不做** 雄獅詳情 Playwright 全站爬蟲（優先官網 API + 結構化 HTML；探針 fixture 補測）。
- **不做** monorepo 大爆炸搬遷（`src/line-bot` 暫留原位）。

---

## 目錄 scaffold

漸進新增，不一次重排 `src/`：

```text
immich-apps/                          # 日後 rename → family-memories
├── apps/
│   └── planner/
│       ├── src/
│       │   ├── index.ts              # HTTP + MCP 入口
│       │   ├── config/env.ts
│       │   ├── routes/
│       │   │   ├── health.ts
│       │   │   ├── wizard.ts
│       │   │   ├── tours.ts          # extract, compare
│       │   │   └── shortlist.ts
│       │   ├── mcp/
│       │   │   ├── server.ts         # streamable HTTP MCP
│       │   │   └── tools.ts          # tool 定義 → 共用 service
│       │   ├── services/
│       │   │   ├── wizard-engine.ts
│       │   │   ├── wizard-parser.ts  # 模糊日期／天數／must
│       │   │   ├── tour-search.ts
│       │   │   ├── tour-extract.ts
│       │   │   ├── shortlist.ts
│       │   │   └── quota.ts
│       │   ├── adapters/
│       │   │   ├── types.ts
│       │   │   ├── lion/
│       │   │   │   ├── search.ts     # 自 scripts/trip 遷入
│       │   │   │   ├── extract.ts
│       │   │   │   └── normalize.ts
│       │   │   ├── cola/extract.ts
│       │   │   ├── phoenix/extract.ts
│       │   │   └── generic-llm/extract.ts
│       │   ├── auth/
│       │   │   ├── middleware.ts     # Bearer api_key
│       │   │   └── family-admin.ts   # invite 兌換（白名單）
│       │   ├── db/
│       │   │   ├── client.ts
│       │   │   └── migrations/
│       │   ├── cache/
│       │   │   ├── redis.ts
│       │   │   └── extract-cache.ts
│       │   └── metrics.ts
│       ├── package.json              # workspace 子包（或根 tsconfig path）
│       └── Dockerfile
├── packages/
│   └── planner-schema/
│       ├── src/
│       │   ├── tour-summary.ts       # TourSummary SSOT
│       │   ├── wizard-session.ts
│       │   ├── date-window.ts
│       │   ├── duration-range.ts
│       │   └── api-types.ts          # REST/MCP 共用 DTO
│       └── package.json
├── deploy/helm/
│   └── family-planner/               # 對齊 immich-line-bot 結構
├── scripts/
│   ├── trip/                         # Phase A 末期 deprecate → 薄 wrapper
│   └── planner-smoke/                # 白名單驗收腳本
└── docs/00_planning/planner/
    └── 10_PHASE_A_IMPLEMENTATION_PLAN.md
```

**與現有 repo 關係**：

| 現有 | Phase A 用法 |
| ------ | ------------- |
| `scripts/trip/lion-*.ts` | 遷入 `apps/planner/adapters/lion/` + `packages/planner-schema` |
| `src/shared/logger` | 共用或複製輕量 wrapper |
| `src/auth/*` | 參考 Bearer／Redis 慣例；planner 用 **family api_key**，非 LINE session |
| `deploy/helm/immich-line-bot` | Chart 模板、1Password、Ingress、ServiceMonitor 模式 |

---

## Wizard 設計（Phase A）

| Step | 欄位 | 輸入範例 | 解析產物 |
| ------ | ------ | --------- | --------- |
| `when` | 出發區間 | 暑假、7–8 月、明年 1 月底 | `DateWindow { from, to, label? }` |
| `duration` | 天數 | 4–5 天、一週左右 | `DurationRange { minDays, maxDays }` |
| `depart_from` | 出發地 | 台北、高雄、不限 | `TPE` / `KHH` / `RMQ` / `ANY` |
| `must` | 硬條件 ≤3 | 無購物、親子、不要購物站 | `string[]` |
| `budget` | 預算 | 兩萬內、2–3 萬 | enum：`<2萬` / `2–3萬` / `3–4萬` / `不限` |
| `review` | 確認 | 是／修改某步 | 通過後允許 `wizard_search` |

**規則**：

- v1 固定 **`tourType=group`**；僅 API 明示 `tourType=fit` 時啟用自由行路徑（Phase A 可回 `not_supported`）。
- 解析信心不足 → `need_clarification` + `clarification` 文案；**不搜尋**。
- Session 存 Redis（TTL 24h）；`familyId` 綁定。

---

## API / MCP Tool 清單

REST 前綴：`/api/planner/v1`  
MCP server 顯示名：`family-memories-planner`  
**同一 service 層**；MCP tool 名與 REST path 對照如下。

### Wizard

| MCP Tool | REST | 說明 |
| -------- | ---- | ---- |
| `wizard_start` | `POST /wizard/sessions` | 建立 session；回傳 `sessionId`、第一步 prompt |
| `wizard_status` | `GET /wizard/sessions/:id` | 目前 step、已填 answers、clarification |
| `wizard_answer` | `POST /wizard/sessions/:id/answer` | body: `{ step, value }`；推進或 clarification |
| `wizard_back` | `POST /wizard/sessions/:id/back` | 回上一步 |
| `wizard_search` | `POST /wizard/sessions/:id/search` | review 通過後搜尋；回傳 `TourSummary[]`（列表精簡） |

### Tours

| MCP Tool | REST | 說明 |
| -------- | ---- | ---- |
| `extract_tour` | `POST /tours/extract` | body: `{ url }` → 完整 `TourSummary` + `extractedAt` |
| `compare_tours` | `POST /tours/compare` | body: `{ tourIds: string[] }` 或 inline summaries；2–N 筆對照表 |

### Shortlist

| MCP Tool | REST | 說明 |
| -------- | ---- | ---- |
| `shortlist_add` | `POST /shortlist` | 加入候選（id 或 extract 結果） |
| `shortlist_list` | `GET /shortlist` | 家庭 shortlist |
| `shortlist_remove` | `DELETE /shortlist/:tourId` | 移除 |

### Auth / Admin（白名單）

| REST | 說明 |
| ---- | ---- |
| `POST /auth/redeem-invite` | body: `{ inviteCode }` → 發行 `apiKey`（一次性或輪換策略見下） |
| `GET /families/me` | 目前 family 資訊、quota 用量 |

**錯誤契約**（共用 JSON）：

```json
{
  "ok": false,
  "error": "need_clarification | quota_exceeded | adapter_failed | not_supported",
  "message": "…",
  "details": {}
}
```

Chat 模型**只依 API 回傳 JSON** 談價格／航班；每筆含 `extractedAt`、`sourceUrl`。

---

## DB Schema 草案（Postgres）

命名空間：`planner` schema 或 table 前綴 `planner_`。

### `families`

| 欄位 | 型別 | 說明 |
| ------ | ------ | ------ |
| `id` | UUID PK | |
| `name` | TEXT | 家庭顯示名 |
| `invite_code` | TEXT UNIQUE | 白名單邀請碼 |
| `invite_max_uses` | INT | 預設 5 |
| `invite_uses` | INT | 已兌換次數 |
| `created_at` | TIMESTAMPTZ | |

### `api_keys`

| 欄位 | 型別 | 說明 |
| ------ | ------ | ------ |
| `id` | UUID PK | |
| `family_id` | UUID FK → families | |
| `key_hash` | TEXT | SHA-256；明文僅建立時回傳一次 |
| `label` | TEXT | 例：`cursor-home`、`chatgpt-dad` |
| `revoked_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | |

### `wizard_sessions`（索引用；熱資料在 Redis）

| 欄位 | 型別 | 說明 |
| ------ | ------ | ------ |
| `id` | UUID PK | = sessionId |
| `family_id` | UUID FK | |
| `step` | TEXT | 目前 wizard step |
| `answers` | JSONB | DateWindow、DurationRange、must… |
| `tour_type` | TEXT | 預設 `group` |
| `result_tour_ids` | TEXT[] | 上次 search 結果 |
| `expires_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `shortlist`

| 欄位 | 型別 | 說明 |
| ------ | ------ | ------ |
| `family_id` | UUID FK | |
| `tour_id` | TEXT | 穩定 id：`agency:groupId` 或 url hash |
| `summary` | JSONB | `TourSummary` 快照 |
| `added_at` | TIMESTAMPTZ | |
| PK | `(family_id, tour_id)` | |

### `extract_cache`

| 欄位 | 型別 | 說明 |
| ------ | ------ | ------ |
| `cache_key` | TEXT PK | normalized URL hash |
| `agency` | TEXT | lion / cola / phoenix / generic |
| `summary` | JSONB | 完整 `TourSummary` |
| `extracted_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ | TTL 6–24h |

### `usage_daily`（quota）

| 欄位 | 型別 | 說明 |
| ------ | ------ | ------ |
| `family_id` | UUID | |
| `date` | DATE | |
| `search_count` | INT | |
| `extract_count` | INT | |
| PK | `(family_id, date)` | |

**Redis**：

- `wizard:session:{id}` — 熱 session（與 DB 非同步或僅 Redis，Phase A 可僅 Redis + 定期 flush 可選）
- `extract:cache:{key}` — 與 Postgres `extract_cache` 二選一或雙層（L1 Redis + L2 PG）

---

## Adapter 介面

```typescript
// packages/planner-schema 或 apps/planner/adapters/types.ts

export type AgencyId = "lion" | "cola" | "phoenix" | "generic";

export interface SearchParams {
  keywords: string;
  dateWindow: DateWindow;
  duration?: DurationRange;
  departFrom?: "TPE" | "KHH" | "RMQ" | "ANY";
  tourType: "group" | "fit";
  mustTags?: string[];
  budget?: string;
  page?: number;
  pageSize?: number;
}

export interface TourSearchAdapter {
  readonly agency: AgencyId;
  supportsSearch: boolean;
  search(params: SearchParams): Promise<TourSummary[]>;
}

export interface TourExtractAdapter {
  readonly agency: AgencyId;
  canHandle(url: URL): boolean;
  extract(url: URL): Promise<TourSummary>;
}

export interface TourAdapterRegistry {
  searchAdapter(agency: AgencyId): TourSearchAdapter | null;
  extractAdapterForUrl(url: URL): TourExtractAdapter | null;
}
```

### Phase A 實作矩陣

| Adapter | 搜尋 | Extract | 備註 |
| ------- | ---- | ------- | ---- |
| `lion` | ✅ `grouplistinfojson` | ✅ 詳情 API／HTML | 自 `lion-search-api.ts` 遷入；`travelType=1` 跟團 |
| `cola` | — | ✅ URL 模式 | hostname / path 規則 |
| `phoenix` | — | ✅ URL 模式 | 同上 |
| `generic-llm` | — | ⚠️ feature-flag | 需 `GENERIC_EXTRACT_LLM_URL`；無 key 則明確失敗 |

**URL 路由**：`extract_tour` → `registry.extractAdapterForUrl` → miss 且 flag on → `generic-llm` → 仍 miss → `adapter_failed`。

---

## k8s 部署概要（`family-planner`）

對齊 [deploy/helm/immich-line-bot](../../../deploy/helm/immich-line-bot/) 慣例。

```text
Ingress (HTTPS)  planner.3q.fi   # 或 planner.family-memories.3q.fi
  └─ family-planner Deployment :3001
       ├─ /health, /metrics
       ├─ /api/planner/v1/*
       └─ /mcp                    # streamable HTTP
  └─ Redis（既有或新 instance）
  └─ Postgres（planner DB 或 shared instance + schema）
```

### Helm values 草案

```yaml
replicaCount: 1
image:
  repository: registry-internal.3q.fi/family-planner
  tag: ""
service:
  port: 3001
ingress:
  enabled: true
  host: planner.3q.fi
  tls:
    enabled: true
env:
  nodeEnv: production
  redisUrl: ""
  databaseUrl: ""          # secret
  genericExtractEnabled: "false"
  wizardSessionTtlHours: "24"
  extractCacheTtlHours: "12"
  quotaSearchPerDay: "30"
  quotaExtractPerDay: "20"
onepassword:
  enabled: true
  plannerDbItemPath: vaults/Infra-Platform/items/Family-Planner-DB
  plannerAdminItemPath: vaults/Infra-Platform/items/Family-Planner-Admin
serviceMonitor:
  enabled: true
  podAnnotations: true
```

### 資源與探針

- `livenessProbe` / `readinessProbe` → `GET /health`
- Prometheus：`/metrics`（request、adapter、extract latency、quota）
- 1Password Operator：`auto-restart` annotation（同 line-bot）

### CI / 映像

- Dockerfile 多階段 build `apps/planner`
- Tekton / Makefile target：`make build-planner`、`make install-planner`（Phase A 末補）

---

## 里程碑（週級）

### A0 — Scaffold（第 1 週）✅

- [x] 建立 `packages/planner-schema`：`TourSummary`、`WizardSession`、`DateWindow`、`DurationRange`
- [x] 建立 `apps/planner`：Express 入口、`/health`、`/metrics`、env config
- [x] 遷移 `scripts/trip/lion-search-api.ts` → `adapters/lion/search.ts`（保留 CLI re-export）
- [x] 遷移 `lion-tour-types.ts` / `lion-tour-normalize.ts` → schema + lion adapter
- [x] Jest：`buildSearchBody`、fixture `jeju-compare.json` 單元測試
- [x] `tsconfig` paths / workspace 設定可 `npm test` 涵蓋 planner 包

### A1 — Wizard + Auth（第 2 週）✅（Postgres 待 A4）

- [x] Postgres migration 檔：`001_a1_auth.sql`（**執行與 store 接線待 A4**）
- [x] `POST /auth/redeem-invite`、Bearer middleware（hash 比對）
- [x] Redis wizard session store（無 Redis 時 in-memory fallback）
- [x] `wizard-engine`：六步狀態機、`wizard_back`
- [x] `wizard-parser`：模糊日期（暑假→DateWindow）、天數、預算 enum
- [x] REST wizard 端點 + review 確認流程
- [x] 手動種子：`FAMILY-DEMO-2026`

### A2 — Search + Extract（第 3 週）✅

- [x] `wizard_search`：串雄獅 search + must／budget 後篩
- [x] `extract_cache` Redis L1 + memory
- [x] Lion extract adapter（`travelinfojson` / `daytripinfojson`）
- [x] Cola / Phoenix extract adapter（URL stub）
- [x] `extract_tour`、`compare_tours` REST + shortlist CRUD
- [x] Quota middleware（`usage_daily` in-memory）
- [x] `generic-llm` adapter（flag off 預設）

### A3 — MCP + Deploy（第 4 週）✅（部分 A4 重疊）

- [x] MCP streamable HTTP `/mcp`；tool 對應共用 service（10 tools）
- [x] `shortlist_*` CRUD（in-memory；Postgres 待 A4）
- [ ] Cursor / ChatGPT 連線說明（`docs/20_guides/planner/MCP_SETUP.md`）
- [x] 本機 smoke：wizard + extract + shortlist（`apps/planner/src/wizard/README.md`）
- [x] `deploy/helm/family-planner` + Tekton `make release-planner`

### A4 — 白名單收尾（第 5 週）🟡 進行中

- [x] `deploy/helm/family-planner` Chart + values-prod
- [x] Production deploy（`family-planner:cafde37` · `immich` ns）
- [ ] `planner.3q.fi` 對外 DNS + 外部 `/health`
- [ ] Postgres 持久化（families · shortlist · usage_daily）
- [ ] Grafana / metrics 文件
- [ ] 家人 onboarding：invite 發放、API key 寫入 Cursor MCP config
- [x] `scripts/trip` README 指向 planner；thin CLI wrapper 保留

---

## 測試策略

### 單元測試（CI 必過）

| 範圍 | 作法 |
| ------ | ------ |
| Lion search | mock `fetch`；驗證 `buildSearchBody` 欄位名（`GoDatestart` 小寫 s） |
| Normalize | `inferTags`、`buildShortName`、`finalizeTour`；fixture [jeju-compare.json](../../../scripts/trip/fixtures/jeju-compare.json) |
| Wizard parser | 口語日期、天數區間、must ≤3 |
| Wizard FSM | step 順序、back、review 前禁止 search |
| Auth | api_key hash、revoked、quota |

### 整合測試（可選 CI nightly）

- Testcontainers Redis + Postgres；wizard 全流程
- Lion search **錄製 fixture**（VCR）避免 CI 打外網

### Smoke 腳本（部署後）

```bash
# scripts/planner-smoke/smoke.sh
PLANNER_URL=https://planner.3q.fi API_KEY=... \
  npx tsx scripts/planner-smoke/wizard-to-shortlist.ts
```

步驟：health → redeem（僅 staging）→ wizard_start → 填滿六步 → wizard_search → extract 一筆 URL → shortlist_add → shortlist_list。

### 手動驗收

- Cursor MCP：實際對話完成「濟州 8 月、5 天、無購物」篩選
- ChatGPT connector：同一 API key；確認 JSON 不含幻覺欄位

---

## 自 `scripts/trip` 遷移

| 現有檔案 | 目標 | 動作 |
| --------- | ------ | ------ |
| `lion-search-api.ts` | `adapters/lion/search.ts` | 搬移；export 不變；CLI import 新路徑 |
| `lion-tour-types.ts` | `packages/planner-schema/tour-summary.ts` | 擴充 `id`、`extractedAt`、`agency` union |
| `lion-tour-normalize.ts` | `adapters/lion/normalize.ts` | 搬移 |
| `search-lion-tours.ts` | `scripts/trip/search-lion-tours.ts` | 改為呼叫 `@family-memories/planner` 或薄 wrapper |
| `summary-lion-tour.ts` | 同上 | fixture 測試保留 |
| `fixtures/jeju-compare.json` | `apps/planner/test/fixtures/` | 複製；scripts 保留 symlink 或 import |

**原則**：探針邏輯進 production adapter；CLI 僅 dev／ops 用。Phase A 完成後 `scripts/trip/README.md` 標 **deprecated**，指向 planner smoke。

---

## Auth 依賴與過渡方案

### 目標契約（架構 SSOT）

- `Family` + `invite_code` → 長期 **`api_key`**（Bearer）
- Cursor、ChatGPT、未來 Immich bot **共用 family workspace**

### 與 `src/auth`（LINE）關係

| 項目 | LINE auth（現有） | Planner auth（Phase A） |
| ------ | ------------------- | ------------------------ |
| 身分 | LINE `idToken` → session JWT | Invite → **api_key** |
| 儲存 | Redis（passkey challenge） | Postgres `api_keys` |
| Middleware | `requireAuthSession` | `requireFamilyApiKey` |
| 共用 | Redis client 模式、`src/shared/logger`、Helm secrets 慣例 | |

**Phase A 建議**：**standalone planner auth**（invite + api_key 僅 planner DB），不耦合 LINE session。理由：MCP client 無 LINE；減少 line-bot 部署依賴。

**預留**：`families` 表留 `line_user_id` nullable；Phase B 可做「LINE 登入後綁定 family」。

### 白名單營運

- Admin 手動 INSERT `families` + `invite_code`（或 `pnpm planner:seed-invite`）
- `invite_max_uses` 控制親友兌換
- API key 輪換：新增 key → 作廢舊 key；不支援無限 key 數（每 family ≤5）

---

## Phase A 完成定義（白名單上線）

| # | 驗收項 | 標準 |
| --- | -------- | ------ |
| 1 | Wizard E2E | MCP 或 REST 完成六步 → `wizard_search` 回傳 ≥1 筆雄獅結果 |
| 2 | 模糊解析 | 「暑假」「5 天左右」可解析或明確 `need_clarification` |
| 3 | Extract | 雄獅詳情 URL + 至少一筆可樂或鳳凰 URL 成功；含 `extractedAt` |
| 4 | Compare | 2 筆 fixture 或 live 產生 markdown／JSON 對照 |
| 5 | Shortlist | 家庭維度 persist；重開 MCP 仍可 `shortlist_list` |
| 6 | Auth | 無 key → 401；錯誤 invite → 403；quota 超限 → 429 |
| 7 | MCP = REST | 同一 `wizard_search` 邏輯；無雙份業務 code |
| 8 | Deploy | `planner.*` HTTPS；`/health` OK；metrics scrape |
| 9 | 測試 | CI 綠燈；fixture 測試覆蓋 lion normalize + wizard FSM |
| 10 | 文檔 | MCP 設定指南；架構 SSOT 連結本計畫 |
| 11 | 合規 | 回應含 `sourceUrl`；文件聲明非 OTA、不保證庫存 |

**白名單使用者**：≥2 個家庭（自家 + 1 組親友）各完成一次真實行程篩選並留下 shortlist。

---

## 風險

| 風險 | 緩解 |
| ------ | ------ |
| 雄獅 API 欄位變更 | fixture + 契約測試；adapter 隔離 |
| 可樂／鳳凰 HTML 變更 | extract 失敗明確錯誤；快取縮短 TTL |
| LLM extract 幻覺 | 預設關閉；僅結構化欄位 + 來源引用 |
| Wizard 口語解析不穩 | 寧可 clarification；review 步人工確認 |
| Monorepo 路徑混亂 | Phase A 僅新增 `apps/`、`packages/`；不搬 line-bot |

---

## 參考

| 文件 / 程式 | 用途 |
| ------------- | ------ |
| [FAMILY_MEMORIES_ARCHITECTURE.md](../FAMILY_MEMORIES_ARCHITECTURE.md) | 平台架構 SSOT |
| [scripts/trip/README.md](../../../scripts/trip/README.md) | 雄獅 CLI 探針 |
| [scripts/trip/lion-search-api.ts](../../../scripts/trip/lion-search-api.ts) | 搜尋 API 實作 |
| [src/auth/middleware.ts](../../../src/auth/middleware.ts) | Bearer 中介層參考 |
| [deploy/helm/immich-line-bot/](../../../deploy/helm/immich-line-bot/) | Helm 部署模式 |
| [LIFF_PASSKEY_SETUP.md](../../20_guides/LIFF_PASSKEY_SETUP.md) | 日後 family 帳戶整合 |

---

**下一步**：執行 **A4 收尾**——Postgres 持久化、`MCP_SETUP.md`、家人 invite onboarding、`planner.3q.fi` 對外驗證；並用 Cursor MCP 走完 8 月濟州行程實戰。
