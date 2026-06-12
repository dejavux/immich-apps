# Immich v2.0.1 → v2.7.5 升級 Checklist

> **環境**：`https://immich.3q.fi` · namespace `immich` · node `lama`（server/postgres）+ `worker3`（ML GPU）  
> **Manifest**：`infra-bootstrap/60_apps/immich/immich-deployment.yaml`  
> **目標版本**：`v2.7.5`（2026-04-13）

## ✅ 升級完成紀錄（2026-06-12）

| Phase | 狀態 | 備註 |
|-------|------|------|
| **A2** pg_dump | ✅ | `infra-bootstrap/immich-pg-backup-20260612.sql`（149 MB） |
| **A3** VectorChord | ✅ | `shared_preload_libraries = vchord.so`（已移除 `vectors.so`） |
| **B** rolling update | ✅ | server + ML pin `v2.7.5`；`GET /api/server/version` → 2.7.5 |
| **C** OpenAPI + smoke | ✅ | `openapi:sync` 2.7.5；`npm test` 48/48；smoke E2E API 全綠 |
| **D** 手動驗收 | ⏸ | Web UI 抽查、LINE 對話 E2E 待人工 |

---

## 0. 前置認知

| 元件 | 升級前 | 現況（2026-06-12） |
|------|--------|-------------------|
| immich-server | v2.0.1 (`:release`) | **`v2.7.5`** pin |
| immich-machine-learning | `:release` | **`v2.7.5`** pin |
| postgres | `14-vectorchord0.4.3-pgvectors0.2.0` | 不變（PG14） |
| redis | `valkey:8-bookworm` | 不變 |
| immich-apps OpenAPI | 2.0.1 | **2.7.5** |
| immich CLI（本機 photo-sync） | v2.2+ | 建議 `npm i -g @immich/cli@2.7.5` |

**VectorChord**：deployment 已用官方 VectorChord postgres 映像，通常不需額外 pgvecto.rs 遷移。升級前仍應確認 `shared_preload_libraries`（見 Phase A）。

**photo-sync 續傳**：中斷或 server 重啟後，重跑 `./scripts/photo-sync/immich-sync.sh --library icloud-primary` 即可；CLI 依 hash skip 已上傳檔案（見 `scripts/photo-sync/README.md`）。升級造成的 downtime 只會讓「進行中那一批」失敗，不會重複寫入 blob。

---

## Phase A — 升級前（建議等 icloud 上傳 dry-run = 0 new）

### A1. 記錄現況

```bash
curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/server/version
kubectl get pods -n immich -o wide
kubectl exec -n immich deploy/immich-server -- du -sh /data/upload /data/encoded-video
curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/jobs | python3 -m json.tool
```

- [x] server version = 2.0.1（升級前）
- [x] icloud-primary dry-run：`0 new`
- [x] 記錄 job 佇列 baseline（`videoConversion` waiting≈1110）

### A2. 備份

```bash
# Postgres dump（在 lama 或能連 immich-postgres 的節點）
kubectl exec -n immich deploy/immich-postgres -- \
  pg_dump -U "$(kubectl get secret immich-postgresql-credentials -n immich -o jsonpath='{.data.username}' | base64 -d)" \
  "$(kubectl get secret immich-postgresql-credentials -n immich -o jsonpath='{.data.database}' | base64 -d)" \
  > immich-pg-backup-$(date +%Y%m%d).sql

# 可選：/data/upload 快照（hostPath /mnt/immich on lama）
# sudo rsync -aH /mnt/immich/ /backup/immich-$(date +%Y%m%d)/
```

- [x] pg_dump 完成且可 `head`/`grep CREATE` 驗證
- [x] 備份：`infra-bootstrap/immich-pg-backup-20260612.sql`

### A3. Postgres VectorChord 健檢（避免 2.7.x restart loop）

```bash
kubectl exec -n immich deploy/immich-postgres -- psql -U postgres -d immich -c "SHOW shared_preload_libraries;"
kubectl exec -n immich deploy/immich-postgres -- psql -U postgres -d immich -c "SELECT extname FROM pg_extension WHERE extname IN ('vchord','vectors');"
```

- [x] 已修正 **`vectors.so`**（舊 pgvecto.rs）→ 僅 `vchord.so`：

<!-- 原修正步驟（已完成） -->

```bash
kubectl exec -n immich deploy/immich-postgres -- psql -U postgres -d immich -c \
  "ALTER SYSTEM SET shared_preload_libraries = 'vchord.so';"
kubectl rollout restart deployment/immich-postgres -n immich
kubectl rollout status deployment/immich-postgres -n immich
```

### A4. 讀 Release Notes

- [x] [v2.0.1 … v2.7.5 changelog](https://github.com/immich-app/immich/compare/v2.0.1...v2.7.5)
- [x] [Official upgrading guide](https://docs.immich.app/install/upgrading/)
- [x] 注意 breaking：mobile app 需與 server 同 major；External library 已清空

### A5. 維護窗口準備

- [x] icloud 上傳已完成（dry-run 0 new）後升級

---

## Phase B — 映像 pin + 部署（infra-bootstrap）

### B1. 修改 `60_apps/immich/immich-deployment.yaml`

```yaml
# immich-server
image: ghcr.io/immich-app/immich-server:v2.7.5

# immich-machine-learning
image: ghcr.io/immich-app/immich-machine-learning:v2.7.5
```

- [x] **不要**改 postgres 映像 major version（維持 PG14）
- [x] **不要**用 `:release` 浮動 tag

### B2. 預拉映像（可選，worker3 GPU 節點）

```bash
# lama
crictl pull ghcr.io/immich-app/immich-server:v2.7.5
# worker3
crictl pull ghcr.io/immich-app/immich-machine-learning:v2.7.5
```

### B3. Rolling update 順序

```bash
cd /Users/light0/DEV/infra/infra-bootstrap/60_apps/immich

# 1) ML 先（server 啟動時會連 ML）
kubectl set image deployment/immich-machine-learning \
  immich-machine-learning=ghcr.io/immich-app/immich-machine-learning:v2.7.5 -n immich
kubectl rollout status deployment/immich-machine-learning -n immich

# 2) Server（DB migration 在此執行）
kubectl set image deployment/immich-server \
  immich-server=ghcr.io/immich-app/immich-server:v2.7.5 -n immich
kubectl rollout status deployment/immich-server -n immich
```

- [x] `kubectl apply -f immich-deployment.yaml`（yaml 已 pin v2.7.5）
- [x] server logs 無 FATAL / migration error
- [x] `GET /api/server/version` → 2.7.5

### B4. 升級後 job 觀察

Server 重啟後可能重排 thumbnail / smartSearch / faceDetection：

```bash
watch -n30 'curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/jobs | python3 -c "
import json,sys
for n,d in json.load(sys.stdin).items():
 c=d[\"jobCounts\"]
 if c[\"active\"] or c[\"waiting\"]: print(n, c)
"'
```

- [ ] `metadataExtraction` / `smartSearch` / `faceDetection` 最終 waiting=0
- [ ] ML pod GPU 正常：`kubectl logs -n immich deploy/immich-machine-learning --tail=30`

---

## Phase C — immich-apps OpenAPI sync + LINE Bot

### C1. 更新 OpenAPI spec 與 TS types

```bash
cd /Users/light0/DEV/immich-apps
IMMICH_OPENAPI_VERSION=2.7.5 npm run openapi:sync
```

- [x] `open-api/immich-openapi-specs.json` 更新（660 KB）
- [x] `src/shared/generated/immich-api.d.ts` 更新

### C2. 編譯與測試

```bash
make lint
npm test   # 或專案慣用 test 指令
```

- [x] `npm test` 48/48 pass（2026-06-12）
- [x] search API endpoint smoke 通過（person / smart / thumbnail proxy）

### C3. 本機 Immich CLI（photo-sync）

```bash
npm i -g @immich/cli@2.7.5
immich --version
./scripts/photo-sync/immich-sync.sh --library icloud-primary --dry-run
```

- [ ] CLI 對齊 server（可選：`npm i -g @immich/cli@2.7.5`）
- [x] icloud dry-run **0 new**

### C4. LINE Bot 驗收

```bash
bash scripts/line-bot/smoke-photo-search-e2e.sh --scene "beach sunset" --person rayna
# 部署（若有 openapi/client 變更）
make release
```

- [x] smoke 全綠（API + thumbnail proxy + Qwen）
- [ ] LINE 手動：「找在海邊的照片」「幫我找小蕊一歲半的照片」
- [ ] `make release`（OpenAPI types 變更；Bot runtime 未改，可排下次 deploy）

### C5. 恢復 photo-sync

```bash
# 若 A5 有停 watch
launchctl load ~/Library/LaunchAgents/com.immich.photo-sync.watch.plist

# 續傳 icloud（若尚未完成）
./scripts/photo-sync/immich-sync.sh --library icloud-primary
./scripts/photo-sync/immich-sync.sh --library icloud-primary --dry-run  # expect 0 new
```

---

## Phase D — 升級後驗收

| 項目 | 指令 / 動作 | 預期 | 狀態 |
|------|-------------|------|------|
| 版本 | `GET /api/server/version` | 2.7.5 | ✅ |
| Web UI | 開 <https://immich.3q.fi> | 時間軸、相簿正常 | ⏸ 待人工 |
| 相簿 | Admin → Albums | Local + iCloud | ⏸ 待人工 |
| Smart Search | smoke `beach sunset` | 3 筆 | ✅ |
| 監控 | Grafana immich dashboard | pod up | ⏸ |
| 儲存 | `du -sh /data/upload` | ~115 GB | ✅ |

- [x] 自動化驗收完成
- [x] 更新 `docs/PROGRESS_TRACKING.md`

---

## Rollback（若 server migration 失敗）

1. **不要**刪 PVC / `/data/upload`
2. 還原 deployment 映像至 `v2.0.1`（或升級前實際 tag）
3. 若 DB 已被 migration 污染且 server 起不來 → 還原 A2 pg_dump：

   ```bash
   kubectl exec -i -n immich deploy/immich-postgres -- psql -U postgres -d immich < immich-pg-backup-YYYYMMDD.sql
   ```

4. photo-sync 重跑即可續傳（hash dedupe）

---

## 建議時程

| 時機 | 動作 |
|------|------|
| **現在** | 讓 icloud 上傳跑完；做 A2 備份 + A3 VectorChord 健檢 |
| **上傳完成後** | Phase B rolling update（約 5–15 min downtime） |
| **B 完成後** | Phase C OpenAPI sync + smoke；必要時 `make release` LINE Bot |
| **job 佇列穩定** | Web UI 抽查 + LINE E2E + 恢復 LaunchAgent |

---

## 參考

- [Immich upgrading](https://docs.immich.app/install/upgrading/)
- [VectorChord migration](https://docs.immich.app/install/upgrading/#migrating-to-vectorchord)
- [Discussion #27946 — stale vectors.so restart loop](https://github.com/immich-app/immich/discussions/27946)
- 本 repo：`scripts/photo-sync/README.md`（續傳）、`scripts/openapi/fetch-spec.sh`
