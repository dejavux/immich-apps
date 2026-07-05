# Immich v2.7.5 → v3.0.0 升級 Spike

> **目的**：評估 `immich-apps`（LINE Bot · photo-sync · OpenAPI client）升級至 Immich v3.0.0 的影響與建議步驟。  
> **環境**：`https://immich.3q.fi` · namespace `immich` · server 映像 `ghcr.io/immich-app/immich-server:release`  
> **Spike 日期**：2026-07-05  
> **前置升級紀錄**：[IMMICH_v2.7.5.md](./IMMICH_v2.7.5.md)

---

## 1. 現況

| 項目 | 值 |
| ------ | ----- |
| Cluster API 版本 | **2.7.5**（`GET /api/server/version`） |
| Postgres | PG14 · VectorChord（`vchord.so`；v2.7.5 升級時已移除 `vectors.so`） |
| LINE Bot 映像 | `registry-internal.3q.fi/immich-line-bot:631e855` |
| OpenAPI pin（repo） | `IMMICH_OPENAPI_VERSION=2.7.5` · spec **647,998 bytes** |
| immich-apps 測試 | `npm test` **137/137** pass（2026-07-05） |

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

- [ ] Staging `GET /api/server/version` = 3.0.0
- [ ] `IMMICH_OPENAPI_VERSION=3.0.0 npm run openapi:sync` committed
- [ ] `npm test` 全綠 · `type-check` 無錯
- [ ] `smoke-photo-search-e2e.sh` 全綠（對 v3 staging）
- [ ] LINE 手動：上傳照片/原檔/影片 + 搜尋 + carousel
- [ ] photo-sync dry-run 0 unexpected errors
- [ ] Rollback 演練文件更新

---

## 參考

- 本 repo v2.7.5 升級紀錄：[IMMICH_v2.7.5.md](./IMMICH_v2.7.5.md)
- OpenAPI 腳本：`scripts/openapi/fetch-spec.sh`
- LINE smoke：`scripts/line-bot/smoke-photo-search-e2e.sh`
- 叢集 manifest：`infra-bootstrap/60_apps/immich/immich-deployment.yaml`
