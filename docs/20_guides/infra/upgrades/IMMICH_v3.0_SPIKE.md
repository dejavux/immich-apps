# Immich v2.7.5 → v3.0.0 升級 Spike

> **目的**：評估 `immich-apps`（LINE Bot · photo-sync · OpenAPI client）升級至 Immich v3.0.0 的影響與建議步驟。  
> **環境**：`https://immich.3q.fi` · namespace `immich` · server/ML 映像 **pin `v2.7.5`**（2026-07-16 自 `:release` 釘回，見 §8）  
> **Spike 日期**：2026-07-05  
> **前置升級紀錄**：[IMMICH_v2.7.5.md](./IMMICH_v2.7.5.md)

---

## 1. 現況

| 項目 | 值 |
| ------ | ----- |
| Cluster API 版本 | **2.7.5**（`GET /api/server/version`） |
| Postgres | PG14 · VectorChord（`vchord.so`；v2.7.5 升級時已移除 `vectors.so`） |
| LINE Bot 映像 | `registry-internal.3q.fi/immich-line-bot:631e855` |
| OpenAPI pin（repo） | **`3.0.0`** · spec **777,446 bytes**（已 commit；`deviceId` 上傳欄位已移除） |
| immich-apps 測試 | `npm test` **170/170** · `type-check` 無錯（2026-07-16） |
| 維護 runbook | [IMMICH_v3_CUTOVER_RUNBOOK.md](./IMMICH_v3_CUTOVER_RUNBOOK.md) · `scripts/infra/v3-cutover-precheck.sh` |

**v3 前置條件（已滿足）**：VectorChord 遷移完成；v3 **不再支援 pgvecto.rs**。

---

## 2. v3.0.0 重點與官方文件

| 資源 | 連結 |
| ------ | ------ |
| Release blog | <https://immich.app/blog/v3.0.0-release> |
| Migration guide | <https://immich.app/blog/v3-migration> |
| Upgrading（VectorChord） | <https://docs.immich.app/install/upgrading/> |
| GitHub release | <https://github.com/immich-app/immich/releases/tag/v3.0.0> |

### 使用者面向亮點（摘錄）

- Mobile 非破壞性編輯、背景備份改善、完整性檢查
- 即時影片轉碼、OCR、直接上傳至相簿
- 大量月份瀏覽效能改善

### 對整合方（immich-apps）相關的 Breaking changes

1. **API 驗證**：class-validator → **Zod**；錯誤回應格式改變；`correlationId` 改為 `X-Correlation-ID` header。
2. **上傳 DTO**：`AssetMediaCreateDto` **移除** `deviceId`、`deviceAssetId`（LINE Bot 與 photo-sync 目前仍傳送）。
3. **資產回應**：`AssetResponseDto` 移除 `deviceId`、`deviceAssetId`、`unassignedFaces`。
4. **搜尋 DTO**：`MetadataSearchDto` / `SmartSearchDto` 移除 device 相關欄位。
5. **端點移除**：`/assets/random`、`/assets/exist`、`/assets/device/{deviceId}`、舊 timeline sync（`/sync/delta-sync`、`/sync/full-sync`）等。
6. **PUT `/assets/{id}/original`**：v3 僅保留 GET（v2.7.5 有 PUT）。
7. **pgvecto.rs**：v3 完全移除；本叢集已用 VectorChord，風險低。

---

## 3. OpenAPI diff（v2.7.5 → v3.0.0）

以 `IMMICH_OPENAPI_VERSION=3.0.0 npm run openapi:fetch` 取得 spec（**777,446 bytes**，+129 KB），與 repo 內 v2.7.5 比對：

| 指標 | v2.7.5 | v3.0.0 |
| ------ | -------- | -------- |
| Paths 總數 | 163 | 173 |
| 移除 path | — | 7 |
| 新增 path | — | 17 |
| HTTP method 變更 | — | 1（`/assets/{id}/original` 移除 PUT） |

### 移除的 paths（全部）

```
/assets/device/{deviceId}
/assets/exist
/assets/random
/plugins/triggers
/server/theme
/sync/delta-sync
/sync/full-sync
```

### 新增 paths（與 immich-apps 可能相關）

```
/albums/{id}/map-markers
/assets/{id}/video/stream/*   (HLS 串流，4 條)
/oauth/backchannel-logout
/admin/integrity/*            (完整性報告)
/workflows/*                    (工作流)
```

### LINE Bot 熱路徑狀態

| 端點 | v2.7.5 | v3.0.0 | immich-apps 使用 |
| ------ | -------- | -------- | ---------------- |
| `POST /assets` | ✅ | ✅ | `uploadAsset()` |
| `GET /assets/{id}` | ✅ | ✅ | metadata poll |
| `POST /search/metadata` | ✅ | ✅ | 人物/日期/地點搜尋 |
| `POST /search/smart` | ✅ | ✅ | CLIP 語意搜尋 |
| `GET /search/person` | ✅ | ✅ | 人名解析 |
| `GET /api/albums` + `PUT .../assets` | ✅ | ✅ | LINE 上傳相簿 |
| `GET /assets/{id}/thumbnail` | ✅ | ✅ | media proxy |

**結論**：核心搜尋/上傳 path **仍存在**；主要程式變更為 **上傳欄位** 與 **回應 DTO 映射**，非端點大規模替換。

### Schema 差異（需改 code）

| Schema | 變更 |
| ------ | ------ |
| `AssetMediaCreateDto` | 移除 `deviceId`、`deviceAssetId` |
| `AssetResponseDto` | 移除 `deviceId`、`deviceAssetId`、`unassignedFaces` |
| `MetadataSearchDto` | 移除 `deviceAssetId`、`deviceId` |
| `SmartSearchDto` | 移除 `deviceId` |

完整 sync 指令（staging 驗證後才 commit）：

```bash
cd /Users/light0/DEV/immich-apps
IMMICH_OPENAPI_VERSION=3.0.0 npm run openapi:sync
npm run type-check
npm test
```

---

## 4. immich-apps 可能受影響檔案

| 檔案 | 風險 | 說明 |
| ------ | ------ | ------ |
| `src/shared/immich-client.ts` | **高** | `uploadAsset()` 仍 append `deviceId`/`deviceAssetId`；`updateAssetDescription()` 嘗試 PUT |
| `src/line-bot/handlers/line-webhook.ts` | **中** | 上傳時傳 `deviceId: LINE-{userId}` |
| `src/shared/types/immich.ts` | **中** | `UploadAssetOptions` 含 device 欄位 |
| `src/shared/map-search-asset.ts` | **低–中** | 若依賴 `AssetResponseDto` 已刪欄位需調整 |
| `src/shared/asset-metadata.ts` | **低** | `snapshotFromAssetResponse` 映射 |
| `src/shared/generated/immich-api.d.ts` | **自動** | `openapi:sync` 後 type-check 會指出斷點 |
| `src/shared/openapi-types.ts` | **低** | 型別別名 re-export |
| `src/line-bot/services/photo-search-service.ts` | **低** | 搜尋 path 不變；錯誤格式變更可能影響除錯 |
| `scripts/photo-sync/immich_api_upload.py` | **中** | 仍送 `deviceId`/`deviceAssetId` |
| `deploy/helm` / `infra-bootstrap` | **高** | server + ML 映像 pin `v3.0.0` |

**未使用、可忽略**：`/assets/random`、`/sync/*`、shared-link 兩步驟上傳（LINE Bot 未整合）。

---

## 5. 建議 Spike 步驟

### Phase A — 準備（不動 production）

1. **pg_dump**（沿用 [IMMICH_v2.7.5.md](./IMMICH_v2.7.5.md) A2 指令）。
2. 記錄 baseline：`GET /api/server/version`、job 佇列、`npm test` 137/137。
3. 確認 `shared_preload_libraries = vchord.so`（v3 硬性需求）。

### Phase B — Staging pin v3.0.0

1. 在 **staging** 或維護窗口更新 `immich-deployment.yaml`：
   - `immich-server:v3.0.0`
   - `immich-machine-learning:v3.0.0`
2. ML → Server rolling update；觀察 migration log。
3. `GET /api/server/version` → 3.0.0。

### Phase C — immich-apps 對齊

1. `IMMICH_OPENAPI_VERSION=3.0.0 npm run openapi:sync`
2. 移除或條件化 `deviceId`/`deviceAssetId` 上傳欄位（v3 忽略未知 multipart 欄位與否需實測）。
3. `make lint` · `npm test` · `bash scripts/line-bot/smoke-photo-search-e2e.sh`
4. `make release` → LINE E2E：上傳（照片/原檔/影片）、搜尋、LIFF Passkey。

### Phase D — photo-sync

1. `npm i -g @immich/cli@3.0.0`（或對應版本）
2. `immich-sync.sh --dry-run` 各 library
3. 更新 `immich_api_upload.py` device 欄位

### Phase E — Production cutover

1. 維護窗口 · pg_dump
2. Pin v3.0.0 · deploy LINE Bot 對齊 commit
3. 觀察 `metadataExtraction` / `smartSearch` / `faceDetection` job 排空
4. Web UI + 家族 LINE 驗收

---

## 6. 風險評估與時程建議

| 風險 | 等級 | 緩解 |
| ------ | ------ | ------ |
| DB migration 失敗 | 中 | pg_dump + 映像 rollback 至 v2.7.5 |
| LINE 上傳因 device 欄位失敗 | 中 | staging 實測 POST `/api/assets`；移除多餘 form 欄位 |
| 搜尋回應 DTO 映射錯誤 | 低–中 | `mapSearchAssetItem` 單元測試 + smoke E2E |
| Zod 驗證錯誤格式 | 低 | 僅影響錯誤訊息解析，非 happy path |
| ML / GPU 節點 | 低 | 與 v2.7.5 相同 pin 流程 |
| mobile app 版本 | 低 | 家族 App 需與 server major 對齊（upstream 要求） |

### Defer vs Proceed

| 選項 | 建議 |
| ------ | ------ |
| **Defer（維持 v2.7.5）** | 若近期無 upstream 安全修補壓力；優先完成 LINE 影片 E2E、Passkey `REDIS_URL`、Qwen 404。 |
| **Proceed（Q3 spike）** | 1–2 天 staging spike：pin v3 + openapi sync + smoke；通過後排維護窗口 production。 |
| **不建議** | 在未跑 staging 的情況下直接 production pin v3。 |

**建議時程**：**2026-07 中下旬** 執行 staging spike（與 Ops W2 rsync 收尾平行）；production 升級待 spike PASS + 維護窗口，**不與** 本週 LINE welcome deploy 綁定。

---

## 7. Spike 完成定義（DoD）

- [ ] Staging `GET /api/server/version` = 3.0.0（**阻擋**：無 staging 叢集，見 §10.6）
- [x] `IMMICH_OPENAPI_VERSION=3.0.0 npm run openapi:sync` committed（spec 777,446 bytes · 2026-07-16 驗證）
- [x] `npm test` 全綠 · `type-check` 無錯（**170/170** · 2026-07-16）
- [ ] `smoke-photo-search-e2e.sh` 全綠（對 **v3** server）
- [x] `smoke-photo-search-e2e.sh` 全綠（對 **v2.7.5** baseline · 2026-07-16 Track C）
- [ ] LINE 手動：上傳照片/原檔/影片 + 搜尋 + carousel（需 v3 server）
- [ ] photo-sync dry-run 0 unexpected errors（需 v3 server）
- [x] Rollback 演練文件更新 → [IMMICH_v3_CUTOVER_RUNBOOK.md](./IMMICH_v3_CUTOVER_RUNBOOK.md) + `scripts/infra/pg-dump-precheck.sh`

---


---

## 8. Production v2.7.5 釘版（anti-drift）

| 時間 | 動作 |
| ------ | ------ |
| 2026-07-16 | `kubectl apply -f deploy/manifests/immich-deployment.yaml`（namespace `immich`） |
| 套用前 | `immich-server` / `immich-machine-learning` 為 `:release`；API 仍回 **2.7.5** |
| 套用後 | 兩者映像 `ghcr.io/immich-app/immich-server:v2.7.5`、`…/immich-machine-learning:v2.7.5` |
| 驗證 | `GET /api/server/version` → `2.7.5` · `GET /api/server/ping` → `pong` |

**注意**：manifest 亦含 redis/postgres/services；本次 diff 僅 server/ML 映像標籤變更，postgres pod 未重建。

---

## 9. v3.0.0 Production 維護窗口檢查清單（僅文件 · 待 spike PASS）

> **勿**在未完成 Phase A–C（staging + openapi + smoke）前執行。預估總窗口 **2–3 小時**（含觀察 job 排空）；建議週末或低流量時段。

| 順序 | 步驟 | 負責 | 預估 |
| ------ | ------ | ------ | ------ |
| 1 | 公告維護窗口（家族 LINE / 內部） | Ops | T−24h |
| 2 | `pg_dump` 全庫至安全路徑（沿用 [IMMICH_v2.7.5.md](./IMMICH_v2.7.5.md) A2） | Ops | 15–30 min |
| 3 | 記錄 baseline：version、job 佇列長度、`kubectl get deploy -n immich` 映像 | Ops | 5 min |
| 4 | 更新 `deploy/manifests/immich-deployment.yaml` → `v3.0.0`（server + ML）；**勿**改 postgres 映像除非 upstream 要求 | Ops | 5 min |
| 5 | `kubectl apply -f deploy/manifests/immich-deployment.yaml`（或僅 server/ML Deployment） | Ops | 5 min |
| 6 | `kubectl rollout status` server → ML；tail migration log | Ops | 20–40 min |
| 7 | `GET /api/server/version` = 3.0.0；Web UI 登入 smoke | Ops | 10 min |
| 8 | Deploy **已對齊 v3 OpenAPI** 的 `immich-line-bot` 映像（`make release` commit） | Apps | 15 min |
| 9 | `smoke-photo-search-e2e.sh` + LINE 手動上傳/搜尋 | Apps | 30 min |
| 10 | 觀察 `metadataExtraction` / `smartSearch` / `faceDetection` 排空 | Ops | 30–60 min |
| 11 | photo-sync：`--dry-run` 後選庫增量（若當日要跑） | Ops | 視量 |
| 12 | 更新本文件 DoD §7；若失敗：映像 rollback `v2.7.5` + restore 決策 | Ops | 視情況 |

**Rollback（≤30 min）**：`kubectl apply` pin 回 `v2.7.5`（server/ML）→ rollout → 確認 version；DB 僅在 migration 失敗且無法前進時才考慮 restore dump（需另開決策）。

**建議最早 production 日期**：staging spike DoD §7 全勾 + 維護窗口排程；參考 §6 **2026-07 中下旬 staging**，production **不早於 spike PASS 後一週**。

---

## 10. 維護窗口提案（排程 · 2026-07-16）

> **狀態**：僅文件排程；**勿**於 spike DoD §7 全勾前執行 production cutover。  
> **本次更新**：補齊具體時段、前後檢查與 rollback 決策點；**未**執行任何 kubectl / 映像升級。

### 10.1 建議時段

| 項目 | 建議 |
| ------ | ------ |
| **首選窗口** | **2026-08-09（六）02:00–05:00 HKT**（UTC+8） |
| **備選窗口** | **2026-08-16（六）02:00–05:00 HKT** |
| **窗口長度** | **3 小時**（含 migration、LINE Bot deploy、smoke、job 觀察） |
| **公告時點** | **T−24h**（週五 02:00）於家族 LINE 群組 + 內部 Ops 頻道 |
| **選定理由** | 週末凌晨家族上傳量低；與 §6「spike PASS 後至少一週」對齊（假設 7 月底前完成驗證 spike） |

**排程前提**：下列 §10.5 阻擋項解除後，將首選日寫入家族日曆並於 T−7d 再次確認。

### 10.2 窗口前檢查（T−7d → T−0）

| 時點 | 檢查項 | 通過標準 |
| ------ | ------ | ------ |
| T−7d | DoD §7 全勾 | staging 或等效驗證 spike PASS（見 §10.5） |
| T−7d | `immich-apps` v3 commit | `IMMICH_OPENAPI_VERSION=3.0.0 npm run openapi:sync` **已 push**；`npm test` · `type-check` 全綠 |
| T−7d | LINE Bot 映像 | `make release` 產出 tag 已 push；`deploy/helm/immich-line-bot/values-prod.yaml` image tag 已更新（**先不 deploy**） |
| T−24h | 家族公告 | LINE 群組：維護時段、預期 2–3h 無法上傳/搜尋、緊急聯絡人 |
| T−2h | `pg_dump` | 沿用 [IMMICH_v2.7.5.md](./IMMICH_v2.7.5.md) A2；dump 可 `head`/`grep CREATE`；記錄檔名與大小 |
| T−1h | baseline 快照 | `GET /api/server/version` = **2.7.5**；`GET /api/jobs` 佇列長度；`kubectl get deploy -n immich -o jsonpath='{..image}'` |
| T−30m | LINE Bot smoke（**現行 v2.7.5**） | `bash scripts/line-bot/smoke-photo-search-e2e.sh` 全綠（確認維護前 baseline 正常） |
| T−30m | VectorChord 健檢 | `SHOW shared_preload_libraries` = `vchord.so`（沿用 v2.7.5 A3） |
| T−0 | 值班確認 | Ops + Apps 在線；rollback manifest（v2.7.5 pin）路徑就緒 |

### 10.3 窗口內執行順序（對應 §9）

| 階段 | 時間（相對） | 步驟 | 負責 |
| ------ | ------ | ------ | ------ |
| **A 備份** | T+0–30m | §9 #2 `pg_dump`（若 T−2h 已做可略過，但仍建議窗口內再 dump 一次） | Ops |
| **A 備份** | T+0–10m | §9 #3 baseline 記錄 | Ops |
| **B Server** | T+10–15m | §9 #4 更新 `deploy/manifests/immich-deployment.yaml` → `v3.0.0`（server + ML only） | Ops |
| **B Server** | T+15–20m | §9 #5 `kubectl apply` | Ops |
| **B Server** | T+20–60m | §9 #6 `rollout status` server → ML；tail migration log | Ops |
| **B Server** | T+60–70m | §9 #7 `GET /api/server/version` = **3.0.0**；Web UI 登入 | Ops |
| **C Apps** | T+70–85m | §9 #8 deploy v3 對齊之 `immich-line-bot` 映像 | Apps |
| **C Apps** | T+85–115m | §9 #9 `smoke-photo-search-e2e.sh` + LINE 手動：上傳照片/原檔/影片、搜尋、carousel | Apps |
| **D 觀察** | T+115–175m | §9 #10 job 排空：`metadataExtraction` / `smartSearch` / `faceDetection` | Ops |
| **E 收尾** | T+175m+ | §9 #11 photo-sync `--dry-run`（各 library）；§9 #12 更新 §7 DoD | Ops |

**窗口內中止點**：任一 **§10.4 Rollback 觸發條件** 成立 → 停止後續步驟，進入 rollback。

### 10.4 Rollback 觸發條件與程序

**立即 rollback（≤30 min）若出現任一項**：

| # | 觸發條件 |
| ------ | ------ |
| R1 | server/ML `rollout` 失敗或 pod CrashLoop；migration log 出現不可恢復錯誤 |
| R2 | 窗口內 **40 min** 後 `GET /api/server/version` 仍 ≠ **3.0.0** |
| R3 | Web UI 無法登入或 `/api/server/ping` 非 `pong` |
| R4 | `smoke-photo-search-e2e.sh` 失敗（上傳或搜尋 happy path） |
| R5 | LINE 手動驗收：上傳或 carousel 搜尋連續 2 次失敗 |

**Rollback 程序**（沿用 §9）：

1. `kubectl apply` pin 回 `v2.7.5`（server + ML）→ `rollout status`
2. 確認 `GET /api/server/version` = **2.7.5**
3. 若已 deploy v3 LINE Bot → rollback 至維護前 image tag
4. 重跑 `smoke-photo-search-e2e.sh`（對 v2.7.5）
5. **DB restore**：僅當 migration 已寫入不可逆變更且 server 無法以 v2.7.5 啟動時，依 A2 dump restore（需另開決策會議；預設不 restore）

**窗口後降級觀察（不 rollback 但標記風險）**：job 佇列 2h 內未下降、photo-sync dry-run 出現非預期 4xx/5xx → 當日不再跑增量 sync，次日評估。

### 10.5 窗口後驗收（T+0 至 T+24h）

| 檢查 | 指令 / 動作 | 通過標準 |
| ------ | ------ | ------ |
| API 版本 | `curl …/api/server/version` | `major` = 3 · `minor` = 0 |
| LINE E2E | `smoke-photo-search-e2e.sh` + 家族抽樣上傳 | 全綠；至少 1 位家族成員確認 |
| Web UI | 瀏覽器登入、月份瀏覽、縮圖載入 | 無 5xx |
| Job 健康 | `GET /api/jobs` | 無異常堆積（對照 §9 #10 baseline） |
| photo-sync | `./scripts/photo-sync/immich-sync.sh --dry-run` 各 library | **0 unexpected errors** |
| 文件 | 更新 §7 DoD 全勾；§8 改記 v3 pin 日期 | committed |

### 10.6 目前阻擋項（2026-07-16 · Track C 更新）

| 阻擋 | 現況 | 解除條件 |
| ------ | ------ | ------ |
| **無 staging 叢集** | 僅 production `immich.3q.fi`；無法依 §5 Phase B 隔離驗證 | 建立 staging **或** 接受維護窗口內首次 pin v3 的風險（**不建議**，見 §6） |
| **v3 server smoke 未跑** | v2.7.5 baseline smoke **PASS**（2026-07-16）；§7 對 v3 的 smoke／手動 E2E **未驗證** | 窗口內 pin v3 後跑 `smoke-photo-search-e2e.sh` + LINE 手動；或先建 staging |
| **LINE Bot 映像未對齊 v3 commit** | production Bot `cafde37`（pre-v3-openapi commit）；OpenAPI／code 已在 main | `make release` push + 窗口 deploy 對齊 commit |
| **photo-sync v3 dry-run** | `immich_api_upload.py` 已移除 device 欄位；未對 v3 API 實測 | 窗口內或 staging `--dry-run` 0 errors |
| **Spike DoD 部分完成** | §7 四項已勾（openapi · tests · v2.7.5 smoke · rollback doc）；四項待 v3 server | 見 [IMMICH_v3_CUTOVER_RUNBOOK.md](./IMMICH_v3_CUTOVER_RUNBOOK.md) |
| **Production anti-drift** | §8 pin v2.7.5 已驗證（2026-07-16 `kubectl` + API） | 維持至窗口日；`bash scripts/infra/v3-cutover-precheck.sh` 可重驗 |

**結論**：§10.1 首選日 **2026-08-09** 為目標占位；日曆提醒見 [IMMICH_v3_CUTOVER_RUNBOOK.md](./IMMICH_v3_CUTOVER_RUNBOOK.md)。實際執行須於 **T−7d** 重跑 `v3-cutover-precheck.sh` 並確認 v3 smoke 策略（staging vs 窗口內首次）。

## 參考

- 本 repo v2.7.5 升級紀錄：[IMMICH_v2.7.5.md](./IMMICH_v2.7.5.md)
- **維護窗口 runbook**：[IMMICH_v3_CUTOVER_RUNBOOK.md](./IMMICH_v3_CUTOVER_RUNBOOK.md)
- 窗口前檢查：`scripts/infra/v3-cutover-precheck.sh` · `scripts/infra/pg-dump-precheck.sh`
- OpenAPI 腳本：`scripts/openapi/fetch-spec.sh`
- LINE smoke：`scripts/line-bot/smoke-photo-search-e2e.sh`
- 叢集 manifest：`deploy/manifests/immich-deployment.yaml`（immich-apps）· `infra-bootstrap/60_apps/immich/`
