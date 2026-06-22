# Immich Enhancement Project - Progress Tracking (SSOT)

**單一真相來源（Single Source of Truth）**：Immich 增強專案所有任務的集中管理。

> 🏗️ **Repo**: <https://github.com/dejavux/immich-apps>（整合 server + LINE Bot + photo sync）  
> 📋 **執行指南**: [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)

**最後更新**: 2026-06-22（Agent Prompts 文件庫 · Phase 3.5 gate 評估 FAIL · purge 待完成）  
**專案狀態**: ✅ Phase 2/3/3.6 結案 · 🟡 Phase 3.5 **收尾（Recently Deleted purge + reconcile）** · Phase 4/5 **明確 defer P2**  
**UX 檢視**: [UX_PRODUCT_REVIEW.md](./UX_PRODUCT_REVIEW.md)  
**負責人**: Infrastructure Team + App Dev Team

---

## 📊 總體狀態

| 指標 | 數值 | 說明 |
|------|------|------|
| 🔴 高優先級任務 | 1 | Phase 3.5 收尾：23 張手動還原 + Recently Deleted purge |
| 🟡 中優先級任務 | 2 | reconcile dry-run 確認 + local-archive 9 new sync |
| 🟢 低優先級任務 | 6 | Phase 4 SSD · V1.1 · tech debt |
| ✅ 本週完成 | 50+ | iCloud 災難復原 · 相簿對帳 · 日期校正 450 筆 · PR #24 |
| 📈 整體進度 | **97%** | Phase 0–3.6: **100%** · Phase 3.5: **~99%** |

---

## 🎯 Phase 概覽

| Phase | 名稱 | 優先級 | 狀態 | 進度 | 預估完成 |
|-------|------|--------|------|------|----------|
| **Phase 0** | Repo 整合 | ✅ 完成 | 100% | ██████████ 100% | 2026-05-27 |
| **Phase 1** | 基礎設施 | ✅ 已部署 | 50% 完成 | █████░░░░░ 50% | 2025-10-06 |
| **Phase 2** | LINE Bot | ✅ 結案 | MVP 100% | ██████████ 100% | 2026-06-12 |
| **Phase 3** | Photo Sync | ✅ 結案 | 100% | ██████████ 100% | 2026-06-13 |
| **Phase 3.5** | iCloud 分層 | 🟢 P1 | purge + reconcile 手動收尾 | ██████████ 99% | 2026-06-22 |
| **Phase 4** | Storage 優化 | 🟢 P2 | 📋 規劃中 | ░░░░░░░░░░ 0% | 2026-07-05 |
| **Phase 5** | Backup 監控 | 🟢 P2 | 📋 規劃中 | ░░░░░░░░░░ 0% | 2026-07-12 |

---

## 🤖 Agent Prompts（Multi-task Orchestration）

**文件庫**：[agent-prompts/README.md](./agent-prompts/README.md)  
**Gate 狀態**：[agent-prompts/GATE_STATUS.md](./agent-prompts/GATE_STATUS.md)（2026-06-22 評估）

| 依賴 | 類型 | 說明 |
|------|------|------|
| 3.5 → 5a | **BLOCK** | tier/reconcile 收尾前不啟動 B2 / CronJob |
| 5a → 4 | **BLOCK** | 還原演練通過後才 SSD 遷移 |
| 1 ∥ 5a | **PARALLEL** | manifest/PR 可平行；prod deploy 錯開 |

**當前 Gate**：Phase 3.5 **FAIL** — reconcile orphan 0 ✅ · Recently Deleted **103** ❌ · 23 張還原未確認 · 建議 **Wave W0**（Task A only）

---

## 🔴 P0：高優先級（Phase 2 - LINE Bot）

**目標**: 從 LINE 轉發照片 → 自動上傳 Immich + AI 標註  
**預估**: 3-5 天（開發）+ 1 天（部署驗收）  
**截止**: 2026-06-21

> 🏗️ **Repo**: `immich-apps` — <https://github.com/dejavux/immich-apps>  
> **Port Range**: **30450-30479**（LINE Bot 預設 30450）  
> **執行指南**: [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)

### 2.0 Repo 建立與初始化

**狀態**: ✅ 完成  
**完成日期**: 2026-05-27

**任務**:

- [x] 建立 GitHub repo: `immich-apps`（整合 server + LINE Bot + photo sync）
- [x] 初始化 Node.js + TypeScript 專案（package.json, tsconfig.json）
- [x] 建立目錄結構（src/, deploy/helm/, deploy/manifests/, scripts/, docs/）
- [x] 複製 Makefile 骨架
- [x] Dockerfile.line-bot
- [x] 遷移 manifests 與文檔（自 infra-bootstrap）
- [x] infra-bootstrap 清理（僅保留指向 README）
- [x] Port range 規劃 → 30450-30479
- [x] 設定 `scripts/dev/pf.sh`（port 30450）
- [x] **CI/CD**：Tekton `ci-tenant-immich-apps` + `make release`（**不需** GitHub Actions workflow）
- [x] **PR CI L0**：`ci/tekton/pr/` + `immich-pr` trigger（typecheck + eslint + helm lint）
- [x] `npm install` + `npm run build` / `type-check` 通過

**驗收**: ✅ Repo + Tekton release 就緒

---

### 2.1 LINE Bot Channel 設定

**狀態**: ✅ 完成  
**完成日期**: 2026-06-10

**任務**:

- [x] 前往 [LINE Developers Console](https://developers.line.biz/)
- [x] Create Provider + LINE Official Account（分享照片 @189oipta）
- [x] 啟用 Messaging API（Channel ID: 2010362663）
- [x] Issue Channel Access Token
- [x] 關閉自動回應訊息
- [x] 設定 Webhook URL: `https://immich-bot.3q.fi/webhook/line`
- [x] 啟用 Webhook + Verify Success（2026-06-11）

**驗收**: ✅ Channel + Token + 公網 Webhook 就緒

---

### 2.2 1Password 憑證設定

**狀態**: ✅ LINE Bot + Immich API Key 完成  
**完成日期**: 2026-06-10

**任務**:

- [x] 建立 vault `Infra-Apps`（若不存在）
- [x] **Item: Immich-LINE-Bot** — channel-id, channel-secret, access-token, bot-id
  - 腳本: `scripts/create-line-bot-op-item.sh`
  - **K8s 使用**: `Infra-Platform`（`scripts/sync-op-items-infra-platform.sh` 自 Infra-Apps 同步）
- [x] **Item: Immich-API-Key** — api-key
  - 腳本: `scripts/create-immich-api-key-op-item.sh`
- [x] **AI 描述（V1.1）**：改用叢集 **Qwen vLLM**（`local-llm/qwen-coder`，OpenAI 相容 API）；**不需** OpenAI-API-Key
  - 叢集內：`http://qwen-coder.local-llm.svc:8001/v1`
  - 本機 dev：`QWEN_BASE_URL=http://127.0.0.1:30420`（`infra-bootstrap/60_apps/local_llm/`）
  - Cursor SDK 僅用於 **lint/commit/PR** 開發流程，非 runtime 照片描述
- [x] K8s `OnePasswordItem` + Operator 同步（Helm deploy 後 Ready）

**驗收**: ✅ LINE + Immich 憑證已同步至 Infra-Platform；Pod secrets OK

---

### 2.3 LINE Bot MVP 源碼

**狀態**: ✅ MVP 完成  
**完成日期**: 2026-06-10

**任務**:

- [x] `src/line-bot/index.ts` — Express + `/health` + `/webhook/line`
- [x] LINE signature 驗證（`@line/bot-sdk` middleware）
- [x] 下載 LINE 圖片 → 上傳 Immich
- [x] 成功/失敗回覆用戶
- [x] `scripts/dev/load-env-from-op.sh` — 從 1Password 載入憑證
- [x] **file 訊息**支援（PR #6）— 保留檔名 + Content-Type；iPhone 需經「檔案」App
- [x] **P0 中繼資料**：`fileCreatedAt` 用 webhook `event.timestamp`；MIME 自 LINE response
- [x] `.envrc` + Cursor lint-fix-agent 整合
- [x] 預設分支 **`main`**（PR #5）
- [x] Helm deploy + 生產 Webhook（見 [K8S_DEPLOYMENT.md](../20_guides/infra/K8S_DEPLOYMENT.md)）

**本機開發**（憑證 + lint + dev）:

```bash
cd immich-apps
npm install && npm run build
eval "$(./scripts/dev/load-env-from-op.sh)"
make lint              # ESLint + Prettier + tsc + markdownlint + shellcheck（無 cspell）
npm run dev
```

**驗收**: `npm run build` + `npm run type-check` 通過；`/health` 可本機驗證

---

### 2.3.1 原檔 / EXIF 調查結論（2026-06-11）

**狀態**: ✅ 已驗證（實測 + Immich API）

| 管道 | 解析度範例 | 相機 EXIF | 適用途 |
|------|------------|-----------|--------|
| LINE「照片」/ 相機 | 960×1706、~280KB | ❌ 無 make/model/GPS | 快速分享 |
| LINE「檔案」（經「檔案」App） | 較大、保留檔名 | ⚠️ 視來源 | 少數原檔 |
| iPhone 直接選「檔案」 | — | — | ❌ 無法從「照片」App 選 |
| **Immich App / Photo Sync** | 原解析度 | ✅ | **原檔 SSOT** |

**決策**: LINE Bot = convenience channel；**Phase 3 Photo Sync** = 原檔 + EXIF 主路徑。

---

### 2.4 本地 / 生產功能測試

**狀態**: ✅ 生產 E2E 完成（2026-06-11）  
**負責**: Dev + Ops

**任務**:

- [x] HTTPS Webhook Verify Success
- [x] 手機傳照片 → Bot 回覆 Immich 連結
- [x] Immich Web UI 確認新照片 + ML 人臉偵測
- [x] 多張批次上傳（8 張）成功（每張獨立 reply，待 P1 imageSet 聚合）

**驗收**: ✅ LINE → Immich 上傳成功率 100%（實測）；Immich ML pipeline 正常

---

### 2.5 Kubernetes 部署（Helm + Tekton + BuildKit + HTTPS）

**狀態**: ✅ 完成（2026-06-12）  
**文檔**: [K8S_DEPLOYMENT.md](../20_guides/infra/K8S_DEPLOYMENT.md) ⭐  
**目前映像**: `registry-internal.3q.fi/immich-line-bot:f906783`（Helm revision 9+）

**目標架構**:

- **Build**: Tekton `ci-tenant-immich-apps` + BuildKit → `registry-internal.3q.fi/immich-line-bot:<git-short-sha>`
- **Deploy**: `make release` → `helm upgrade immich-line-bot` → namespace `immich`
- **HTTPS**: `https://immich-bot.3q.fi/webhook/line`（Route53 → Caddy → ingress-nginx → cert-manager）

**任務**:

- [x] Helm chart `deploy/helm/immich-line-bot/`
- [x] `scripts/dev/pf.sh`（port 30450）
- [x] Tekton release pipeline `ci/tekton/release/`
- [x] infra-bootstrap: `ci-tenant-immich-apps` + bootstrap secrets
- [x] `make release` Tekton PipelineRun 成功（tag = git short SHA）
- [x] Caddy + Route53: `immich-bot.3q.fi` HTTPS + Certificate Ready
- [x] LINE Webhook Verify + E2E 傳照片
- [x] ingress `ssl-redirect: false`（Caddy→ingress HTTP-01 相容）
- [x] BuildKit Task CPU 下調（避免 worker1 Pending，PR #4）

**驗收**: ✅ 全部通過

```bash
curl -sS https://immich-bot.3q.fi/health
kubectl get certificate immich-bot-3q-fi-tls -n immich
kubectl logs -n immich deployment/immich-line-bot --tail=20
```

---

### 2.6 生產環境測試

**狀態**: ✅ 核心案例完成（2026-06-11）  
**負責**: QA / Ops

**任務**:

- [x] 加入 LINE Bot 好友（@189oipta / 分享照片）
- [x] 轉發 / 傳送照片 → 上傳成功 + Bot 回覆連結
- [x] Immich Web UI 確認 + ML 人臉偵測 log
- [x] LINE 相機直拍 EXIF 調查（無相機 metadata，見 §2.3.1）
- [ ] 連續 10 張壓力測試 + 成功率統計
- [ ] 非圖片訊息 / 大檔案邊界案例

**待強化（Phase 2.5+）**:

- [x] P0: EXIF 優先 + `line-forwarded` 標記（PR #10；`upload-timestamps.ts` / `exifr`）
- [x] P1: `imageSet` 批次 summary（單則 reply）— `image-set-batch.ts`
- [x] P1: upload 後 `line-import` / `line-user-{id}` tag — `immich-client.tagAsset`
- [x] P1: LINE 上傳加入 `LINE Inbox` 相簿 — `findOrCreateAlbum` / `addAssetsToAlbum`
- [x] P1: photo-sync 統計 — `immich-sync.sh` 解析 CLI 文字輸出 → `log_dir/stats/*.json`
- [x] P2: 上傳後 poll `hasMetadata`（Bot 回覆拍攝時間 / 人臉）— `waitForAssetMetadata`
- [x] P2: OpenAPI v2.7.5 types — `open-api/` + `npm run openapi:sync`（2026-06-12 升級後 sync）
- [x] P2: Immich server Prometheus（`IMMICH_TELEMETRY_INCLUDE=all`；infra-bootstrap）
- [x] P3: CLIP / metadata 觀察腳本 — `scripts/photo-sync/observe-asset-intelligence.sh`
- [x] P3: XMP sidecar 說明 — `photo-sync.config.yaml.example`
- [x] V1: LINE 自然語言搜尋（人名 + 年齡/日期）— Qwen + `/search/metadata` + session 追問
- [x] V1.5: Smart Search 場景語意（CLIP query，英文）+ Flex carousel 縮圖
- [x] V1 UI: 搜尋結果 Flex carousel（`/media/assets/{id}/preview.jpg` proxy）
- [ ] P3: Qwen vision 繁中 description（V1.1；叢集 `local-llm/qwen-coder`；Immich CLIP 觀察後再決定）
- [ ] Immich CLIP smart tags 觀察（上傳後數分鐘，用 observe 腳本）

**驗收**: 核心 E2E ✅；進階案例與強化功能待下一迭代

---

### 2.7 監控設定

**狀態**: 🚧 metrics 就緒；Grafana 待建  
**負責**: SRE Team

**任務**:

- [x] LINE Bot `/metrics`（`prom-client`：uploads、latency、imageSet batches）
- [x] Helm pod annotations `prometheus.io/scrape`
- [ ] 驗證 Prometheus 指標 scrape + Grafana panel

  ```bash
  kubectl port-forward -n immich svc/immich-line-bot 3000:80
  curl http://localhost:3000/metrics
  ```

- [ ] 建立 Grafana Dashboard
  - [ ] Webhook 請求總數
  - [ ] 上傳成功率
  - [ ] P95 延遲
  - [ ] AI 標註延遲
  - [ ] 錯誤率分佈

- [ ] 設定告警規則
  - [ ] 成功率 < 90% → 發送告警
  - [ ] P95 延遲 > 10 秒 → 發送告警
  - [ ] Pod 重啟次數 > 5 → 發送告警

**驗收**: Grafana Dashboard 可視化所有指標，告警規則測試通過

---

### 2.8 文檔更新

**狀態**: 🚧 進行中（2026-06-12）

**任務**:

- [x] 更新 `PROGRESS_TRACKING.md`（本文件）
- [x] 更新 `HOW_TO_PROCEED.md`、`PHASE2_K8S_DEPLOYMENT.md`
- [x] infra-bootstrap Caddy `immich-bot.3q.fi`（PR #120）
- [x] [IMMICH_v2.7.5.md](../20_guides/infra/upgrades/IMMICH_v2.7.5.md) 升級 checklist
- [ ] Phase 2 完成報告（可選 `PHASE2_COMPLETION_REPORT.md`）

---

## 🟡 P1：中優先級（Phase 3 - Photo Sync）

**狀態**: ✅ **結案**（2026-06-13）  
**目標**: 多個 Mac `.photoslibrary` → Immich（原檔 + EXIF SSOT）  
**預估**: 2-3 天（同步）+ Phase 3.5 分層搬移  
**前置條件**: ✅ Phase 2 核心完成

### 架構決策

| 層 | SSOT | 說明 |
|----|------|------|
| Mac | `.photoslibrary` | iCloud + Local 兩個 library |
| Immich | union + hash dedupe | 兩 library 都 sync，Immich 去重 |
| 分層 | **Phase 3.5** | iCloud 超量→Local · [tier-policy 規格](./photo-sync/tier-policy/10_REQUIREMENTS.md) 🟢 Kickoff |
| 備份 | Phase 5 | Immich server + B2 異地（3-2-1） |

**本機 libraries**（light0 Mac）:

- `~/Pictures/Photos Library.photoslibrary` — iCloud / iPhone sync
- `~/Pictures/LOCAL PHOTO LIBRARY.photoslibrary` — 離線 archive

### 3.0 CLI 煙霧測試

**狀態**: ✅ 完成（2026-06-11）

- [x] Immich CLI 2.2.61 已安裝
- [x] `./scripts/photo-sync/test-upload.sh` — 上傳 1 張 HEIC 成功
- [x] dry-run：`local-archive` 5023 檔 / ~44 GB（0 dup vs DB）
- [x] dry-run：`icloud-primary` 3512 檔 / ~37 GB（待 local 完成後跑）

### 3.1 安裝依賴

**狀態**: ✅ 完成（2026-06-11）

**任務**:

- [x] Immich CLI（`immich --version` → 2.2.61）
- [x] fswatch（`install-launchd.sh` 已安裝）
- [x] 設定檔 `scripts/photo-sync/photo-sync.config.yaml.example`
- [x] 同步腳本 `scripts/photo-sync/immich-sync.sh`（多 library）
- [x] 監控腳本 `scripts/photo-sync/immich-watch.sh`
- [x] PR [#7](https://github.com/dejavux/immich-apps/pull/7) merge · release `ee98e7a`

**驗收**: ✅

---

### 3.2 腳本、憑證與設定

**狀態**: ✅ 完成（2026-06-12）

**任務**:

- [x] `~/.config/immich-apps/photo-sync.config.yaml`
- [x] 多 library config（icloud-primary + local-archive）
- [x] `tier_policy` 區塊（Phase 3.5 預留）
- [x] LaunchAgent `com.immich.photo-sync.watch`（`install-launchd.sh`）
- [x] `bootstrap-credentials.sh` → `~/.config/immich-apps/photo-sync.env`
- [x] `ensure-immich-creds.sh` — 略過 `.env` placeholder
- [x] cspell 加入 `make lint`
- [x] 憑證 fix（PR [#8](https://github.com/dejavux/immich-apps/pull/8)）
- [x] `immich-sync.sh` 統計 JSON、`retry`、pseudo-TTY 進度列
- [x] Caddy 長 timeout（3600s）— infra-bootstrap PR #120

**驗收**: dry-run ✅；LaunchAgent ✅

---

### 3.2.1 伺服器儲存盤點（2026-06-11）

**狀態**: ✅ 完成  
**文檔**: [STORAGE_AUDIT.md](../20_guides/photo-sync/runbooks/STORAGE_AUDIT.md)

**結論**:

- ~112 GB = `upload` 44G + `external-library` 43G×2 + 轉檔 23G + thumbs 2G
- DB ~3143 assets（上傳前）≈ 過去 iCloud/App 子集；**非** LOCAL archive 全量
- LOCAL 5023 檔 vs DB：**0 hash duplicate** → 全量上傳正確
- External library「Migrated photos」：`assetCount: 0` — 磁碟舊副本，upload 完成後可清理

---

### 3.3 初次全量同步

**狀態**: ✅ **完成**（2026-06-12）

**進度摘要**：

| Library | 狀態 | 最終 CLI |
|---------|------|----------|
| local-archive | ✅ | `0 new / 5023 dup` |
| icloud-primary | ✅ | `0 new / 3512 dup`（dry-run 2026-06-12 09:21） |

**icloud 上傳歷程**：

| 跑次 | 結果 |
|------|------|
| 首跑（04:11） | +3396 assets，**115 failed**（502 album update） |
| 續傳（09:10） | +114 assets，**0 failed** |
| dry-run 驗收 | **0 new / 3512 dup** ✅ |

**伺服器（2026-06-12）**：`/data/upload` **115 GB** · API stats **4518 photos / 935 videos**（~5453 assets）

**儲存**：external **已清 ~86 GB**；詳見 [STORAGE_AUDIT.md](../20_guides/photo-sync/runbooks/STORAGE_AUDIT.md)。

**基礎建設修正**（2026-06-11～12）：

- [x] 移除 CLI 已不支援的 `-j`；改解析文字輸出
- [x] 失敗檔 `-c 1` 自動重試 + 502 transient 重跑
- [x] Caddy `immich.3q.fi` 長 timeout（read/write 3600s）
- [x] `immich-sync.sh` pseudo-TTY 轉發（修復進度列不更新）
- [x] 本機 config：`upload_concurrency: 2`、retry 設定

**任務**:

- [x] dry-run local-archive（5023 new / 0 dup）
- [x] **local-archive 全量**（5023 檔，2026-06-12 完成）
- [x] Immich Web UI / API 抽查 EXIF（2026-06-12；album 內 3016 筆 API 回傳，server 共 6016 assets）
- [x] 清理 external-library 冗餘（~86 GB → 4 KB；`/data/upload` 85G 不變）
- [x] LaunchAgent 增量同步（`install-launchd.sh`；已修 `yaml` 依賴）
- [x] **icloud-primary 全量**（3512 檔；首跑 115 failed → 續傳 114/0 failed）
- [x] dry-run 驗收（icloud + local 皆 **0 new**）

**待收尾**：

- [x] LaunchAgent **增量**實測（2026-06-12；fswatch → debounce 30s → icloud 0 new/3512 dup）
- [x] Admin：移除空 External library「Migrated photos」（DB `library` 表 0 rows）
- [x] Immich v2.7.5 升級（2026-06-12；A2 pg_dump + A3 vectors.so + B rolling + C openapi/smoke）
- [x] local-archive 續傳（2026-06-13 dry-run **0 new / 5023 dup**；1894 new 為 hash 變更非 binary dup）

**Local 重複驗證（2026-06-12）**：

- Local library **無 hash 級重複**（5023 檔 → 5023 unique SHA1）
- local vs icloud originals：**0 共用 hash、0 共用檔名**（兩 library 二進位完全 disjoint）
- **~1506 檔** checksum 不在 Immich（增量 sync 判定 1894 new 的主因；可能為 Photos 重編碼後 hash 變更）
- 腳本：`scripts/photo-sync/audit-local-duplicates.py` · 報告 `~/Library/Logs/immich-photo-sync/audit-local-duplicates.json`

**監控**：

```bash
ls -t ~/Library/Logs/immich-photo-sync/stats/icloud-primary-*.json | head -1 | xargs cat
tail -f ~/Library/Logs/immich-photo-sync/sync.log
launchctl print gui/$(id -u)/com.immich.photo-sync.watch
```

**驗收**: ✅ local + icloud 全量；union 完整；hash dedupe 跨 library

---

### 3.4 Launchd 自動啟動

**狀態**: ✅ 已安裝（2026-06-11）

**任務**:

- [x] `com.immich.photo-sync.watch.plist`（`install-launchd.sh`）
- [x] `run-with-op-env.sh` + `photo-sync.env`
- [x] `launchctl bootstrap gui/$(id -u)/com.immich.photo-sync.watch`
- [x] 增量同步實測（2026-06-12）

**驗收**: LaunchAgent running；增量已驗

---

### 3.5 增量同步測試

**狀態**: ✅ **完成**（2026-06-12）

**實測結果**：

| 步驟 | 結果 |
|------|------|
| fswatch 觸發 | `watch.log` 09:26:30 detected → 09:27:00 sync |
| icloud-primary | `0 new / 3512 dup` ✅ |
| local-archive | 意外 `1894 new / 3129 dup`（見上方 Local 重複驗證）|

**任務**:

- [x] 觸發 fswatch（touch originals 或新增照片）
- [x] 等待 debounce 30s + 檢查 `watch.log` / `sync.log`
- [x] icloud dry-run 等價（0 new）
- [x] local 續傳至 `0 new`（2026-06-13 dry-run **0 new / 5023 dup**）

**驗收**: LaunchAgent 增量鏈路正常；local + icloud dry-run 皆 **0 new** ✅

---

## 🟡 P1：Phase 3.5 — iCloud tier policy

**狀態**: 🟡 Phase B 下載尾聲（2026-06-15）  
**規格**: [photo-sync/tier-policy/10_REQUIREMENTS.md](./photo-sync/tier-policy/10_REQUIREMENTS.md)  
**目標**: `tier_policy` 自動將 eligible 照片 icloud → local-archive

### 3.5.0 M1 PoC ✅

- [x] osxphotos 安裝 · 讀 icloud-primary metadata
- [x] eligible 數量（`cutoff_date: 2023-01-01` → **2900**）
- [x] `scripts/photo-sync/tier-policy-poc.sh`（dry-run JSON）
- [x] eligible ⊂ Immich spot-check（577 local-path → **100%** SHA1 dup）
- [x] 跨 library 移動方案評估 → [20_CROSS_LIBRARY_MOVE_RESEARCH.md](./photo-sync/tier-policy/20_CROSS_LIBRARY_MOVE_RESEARCH.md)

### 3.5.1 tier-policy.sh ✅（M3 腳本）

- [x] 讀 config · dry-run / execute / export-only / import-staging
- [x] bulk export + bulk import + verify-staging + retry-failed
- [x] Live Photo import 修正（略過 companion `.mov`）
- [x] 人工刪除 source gate（1615 → Recently Deleted · 2026-06-14）
- [ ] 永久清除 Recently Deleted（釋放 iCloud 配額）
- [ ] rollback 實測文件

### 3.5.2 第一輪 bulk 執行（2026-06-14）✅

| 指標 | 數值 |
|------|------|
| cutoff | `--cutoff-days 365` → **2025-06-14** |
| export | **1615** 張（33 batch · local-path only） |
| import verify | **1615 / 1615** ✅ |
| Immich dry-run | **0 new**（兩 library） |
| LOCAL 總數 | 3000 → **4616** |
| `make release` | ✅ **2217530**（Tekton label fix） |

### 3.5.3 Phase B（2026-06-15）✅ 主流程完成

| 指標 | baseline（早） | 最新（16:21） |
|------|----------------|---------------|
| eligible_ismissing | **4119** | **1** |
| export_ready_now | 1 | **4280** |
| local_path | ~160 | **4818** |

- [x] `tier-policy-download-missing.sh` 全量 eligible（4280/4281）
- [x] `tier-policy-monitor-ismissing.sh` 監控
- [x] bulk import + verify-staging（`staging_items: 0` · 2026-06-18）
- [x] immich-sync dry-run icloud **0 new**（2026-06-18）
- [ ] local-archive 續傳 **9 new**（tier import 後）
- [x] ~~`tier-policy-delete-source` Phase B~~ → **6/16-6/17 手動刪除（見災難復原紀錄）**
- [ ] Recently Deleted **永久清除**（288 張 · GUI；⚠️ 先手動還原 23 張，見 §3.5.5）

### 3.5.4 iCloud 災難復原（2026-06-16–18）✅

**事件**：`tier-policy-delete-source` Phase B 後手動在 Photos GUI 刪除，**4,277** 張被送入 Recently Deleted，導致 icloud-primary 個人圖庫幾近清空。

| 步驟 | 結果 |
|------|------|
| LOCAL PHOTO LIBRARY | ✅ **9,009 張** 完整無損（~146 GB）|
| Immich 備份 | ✅ **6,961** active assets（union 完整） |
| 從 Immich 回復 icloud-primary | ✅ 638 張（近 1 年照片）|
| Immich `Mac Photos (iCloud)` 相簿對帳 | ✅ stale=0 · missing=0 · mac_not_in_immich=0 |
| icloud-primary 日期校正 | ✅ **450** 筆（suspicious 5 + import-mismatch 445）|

**新增工具（PR #24 · `73b1d06`）**：

- `immich_import_to_icloud.py` / `.sh` — Immich → icloud-primary 補缺
- `immich_icloud_album_reconcile.py` / `.sh` — 相簿雙向對帳 + trash 還原 + 補上傳
- `photos_fix_dates_from_immich.py` / `.sh` — Mac Photos 日期校正

**目前 icloud-primary 狀態（2026-06-18）**：

| 指標 | 數值 |
|------|------|
| 個人可見 | **638** |
| Recently Deleted | **288**（含 23 張 1y 內未入 Immich）|
| Immich iCloud 相簿 | **638**（100% 對齊）|

### 3.5.5 收尾 checklist（2026-06-18）

- [ ] 手動還原 Recently Deleted 中 23 張（capture < 1y 且**不在 Immich**）→ 報告：`recovery/trashed-restore-23.json`
- [ ] 確認 23 張已在 icloud-primary 後 → Recently Deleted **全部永久清除**（Photos GUI）
- [ ] `immich-sync.sh --library icloud-primary --dry-run` → **0 new**
- [ ] `immich-icloud-album-reconcile.sh --dry-run` → stale=0 · missing=0
- [ ] local-archive 補傳 **9 new**（`immich-sync.sh --library local-archive`）
- [ ] `immich-reconcile.sh --dry-run` → 確認 orphan 數量合理
- [ ] 更新本節狀態 → ✅ Phase 3.5 結案

→ 詳細步驟：[30_PHASE_B_ICLOUD_DOWNLOAD.md](./photo-sync/tier-policy/30_PHASE_B_ICLOUD_DOWNLOAD.md)

### 3.5.4 整合

- [ ] LaunchAgent / cron
- [x] runbook [TIER_POLICY.md](../20_guides/photo-sync/runbooks/TIER_POLICY.md)

**已完成**: config schema · M1/M2 研究 · M3 腳本 · 第一輪 1615 張 export→import→verify

---

## ✅ P1 完成：Phase 3.6 — Delete Reconcile

**狀態**: ✅ M1/M2/M3/M3.1（PR #19–#22）· 歸檔 [60_completed](../60_completed/phase3-6-delete-reconcile/)  
**規格**: [60_completed/phase3-6-delete-reconcile/10_REQUIREMENTS.md](../60_completed/phase3-6-delete-reconcile/10_REQUIREMENTS.md)  
**維運**: [20_guides/photo-sync/runbooks/RECONCILE_OPERATIONS.md](../20_guides/photo-sync/runbooks/RECONCILE_OPERATIONS.md)

### 3.6.1 實作 ✅

- [x] `delete_policy: conservative`（雙 library SHA1 皆無才 trash Immich orphan）
- [x] `immich-reconcile.sh` dry-run / `--apply --confirm`（album scope + mac uploads）
- [x] `immich_api_upload.py` + `upload_mode: api`（`fileCreatedAt` 來自 Photos `photo.date`）
- [x] `immich-fix-dates.sh` 批量修復 CLI mtime 問題（~3500+ 筆）
- [x] `install-reconcile-launchd.sh` 週日 04:00 dry-run
- [x] M3 fswatch watch（PR #20）
- [x] M3.1 `photos_db_libraries` + `include_mac_uploads` + `grace_days: 0`（PR #21 merge）
- [x] `immich-reconcile-diagnose.sh`（asset id → mac_ref 狀態）

### 3.6.2 實測 ✅

| 日期 | 項目 | 結果 |
|------|------|------|
| 2026-06-15 | 首次 apply（album scope） | **484** trashed → dry-run **0** |
| 2026-06-17 | apply（M3.1 scope） | **+17** trashed |
| 2026-06-18 | dry-run（post-purge 前） | `orphan_candidates: 20` · `orphan_ready_for_apply: 20` |

### 3.6.3 維運要點（2026-06-17）

- **purge 後才刪**：icloud `photos_db_libraries` 下，「最近刪除」未永久清除 → `mac_ref=1` → reconcile **skip**（設計如此）
- **檔名勿當 SSOT**：`IMG_1903` 等會跨年重用；對照用 Immich UUID / 拍攝日期（見 [20_OPERATIONS.md](./photo-sync/delete-reconcile/20_OPERATIONS.md)）
- **案例**：2026-06-16 17:16 四張（瓦斯表+文件）— `IMG_1904/1905` 在最近刪除、`1903/1906` 仍在圖庫 → 待 purge 後再 reconcile

**維運**：tier 搬移後 Immich **不刪**（local-archive 仍為 retention）；reconcile apply 僅在 dry-run 確認後手動執行。

---

## 📋 Optional — Photo Edit + AI

**狀態**: 📋 規劃中（P3 · 非 Sprint 主軌）  
**規格**: [photo-edit/10_REQUIREMENTS.md](./photo-edit/10_REQUIREMENTS.md)

| 階段 | 內容 | 狀態 |
|------|------|------|
| A | Sidecar `photo-edit-bff` + rembg / Real-ESRGAN PoC | 📋 |
| B | ComfyUI workflow + Immich Workflow hook | 📋 |
| C | Web before/after + 批次 queue | 📋 |

**原則**: 不覆蓋原 blob；Mac Photos SSOT；新 asset + `source:{id}` tag

---

## 📋 Optional — Similar images / 重複偵測

**狀態**: 📋 待驗證（P2）  
**規格**: [photo-sync/similar-images/10_REQUIREMENTS.md](./photo-sync/similar-images/10_REQUIREMENTS.md)  
**Runbook**: [SIMILAR_IMAGES_EVAL.md](../20_guides/photo-sync/runbooks/SIMILAR_IMAGES_EVAL.md)

| 步驟 | 狀態 |
|------|------|
| 啟用 Duplicate Detection + job 完成 | 📋 |
| Ground truth 20 組 + recall/precision | 📋 |
| 決策：內建 vs `similar-images-audit.py` | 📋 |

**背景**：checksum dedupe 無法抓 Photos 重編碼（~1506 hash-miss）；Immich L3 用 CLIP embedding 可能可補。

---

## 🟢 P2：低優先級（Phase 4-5）

### Phase 4: 存儲優化

**狀態**: 📋 規劃中  
**預估**: 1-2 天  
**截止**: 2026-06-09

**任務**:

- [ ] PostgreSQL 資料庫備份
- [ ] 在 NVMe 建立目錄 `/nvme/immich-postgres`
- [ ] 停止 PostgreSQL Pod
- [ ] 遷移資料到 SSD
- [ ] 修改 PV hostPath
- [ ] 重啟 PostgreSQL
- [ ] 效能測試（目標：-50% 查詢延遲）
- [ ] 縮圖目錄配置到 SSD

---

### Phase 5: 備份與監控

**狀態**: 📋 規劃中  
**預估**: 2-3 天  
**截止**: 2026-06-15

**任務**:

- [ ] 建立 Backblaze B2 bucket
- [ ] 設定 B2 憑證到 1Password
- [ ] 部署 PostgreSQL 備份 CronJob（每日）
- [ ] 部署照片備份 CronJob（每週）
- [ ] 測試備份還原流程
- [ ] 建立 Grafana Dashboard
- [ ] 設定告警規則

---

## 📊 成功指標追蹤

### Phase 2 - LINE Bot

| 指標 | 目標 | 當前 | 狀態 |
|------|------|------|------|
| 上傳成功率 | > 95% | - | ⏳ 待測試 |
| P95 延遲 | < 5s | - | ⏳ 待測試 |
| AI 標註覆蓋率 | 100% | - | ⏳ 待測試 |
| 服務可用性 | > 99% | - | ⏳ 待部署 |

### Phase 3 - Photo Sync

| 指標 | 目標 | 當前 | 狀態 |
|------|------|------|------|
| local-archive 覆蓋 | 5023/5023 | 5023/5023 | ✅ |
| icloud-primary 覆蓋 | 3512/3512 | 3512/3512 | ✅ |
| hash dup（跨 library） | 預期低 | **1**（dry-run 3512 dup） | ✅ |
| 同步延遲（增量） | < 5 min | — | ⏳ LaunchAgent 待驗 |
| 上傳成功率 | > 98% | icloud 續傳 100% | ✅ |

---

## 🔄 每週進度更新

### Week 1 (2026-05-27 ~ 2026-06-02)

**目標**: 完成 Phase 2 LINE Bot

**已完成**:

- [x] 2026-05-27: 專案規劃文檔建立
- [x] 2026-05-27: 文檔模組化重構
- [x] 2026-05-27: GPU 配置澄清
- [x] 2026-05-27: 優先級調整（LINE Bot > Photo Sync）
- [x] 2026-05-27: PROGRESS_TRACKING.md 建立
- [x] 2026-05-27: PHASE2_LINE_BOT.md 完整實作文檔

**進行中**:

- [ ] LINE Bot Channel 設定
- [ ] 1Password 憑證準備
- [ ] 開發環境設定

**計畫下週**:

- [ ] 本地功能測試
- [ ] Kubernetes 部署
- [ ] 生產環境測試

---

### Week 2 (2026-06-03 ~ 2026-06-09)

**目標**: 完成 Phase 3 Photo Sync + 開始 Phase 4

**計畫**:

- [ ] Mac Photos Library 同步設定
- [ ] 初次全量同步
- [ ] Launchd 自動啟動
- [ ] PostgreSQL 遷移到 SSD

---

## 🐛 問題追蹤

### 開放問題

| ID | 問題 | 狀態 |
|----|------|------|
| #4 | icloud-primary 全量 | ✅ 2026-06-12（0 new dry-run） |
| #5 | Immich server v2.0.1 → v2.7.5 升級 | ✅ 2026-06-12 |
| #9 | LaunchAgent 增量實測 | ✅ 2026-06-12 |

---

### 已解決問題

| ID | 問題 | 解決方案 | 解決日期 |
|----|------|----------|----------|
| #1 | lama GPU 是否都給 qwen 了？ | 否，lama 有 4 個 GPU，qwen 只用 1 個 | 2026-05-27 |
| #2 | immich-ml 是否可在不同 node？ | 是，當前在 worker3（與 qwen 隔離） | 2026-05-27 |
| #3 | 優先級不明確 | LINE Bot (P0) > Photo Sync (P1) | 2026-05-27 |
| #6 | local-archive 502 album update | Caddy 長 timeout + 續傳；79+80 檔補齊 | 2026-06-12 |
| #7 | external-library ~86 GB 冗餘 | `cleanup-external-library.sh --execute` | 2026-06-12 |
| #8 | icloud 預期大量 dup | 實測 **3512 dup / 0 new**（union 後） | 2026-06-12 |
| #10 | icloud 首跑 115 failed | 續傳 +114/0 failed；dry-run 0 new | 2026-06-12 |
| #11 | v2.7.5 升級 | pg_dump + vectors.so fix + pin v2.7.5 + openapi sync | 2026-06-12 |

---

## 📚 相關文檔

### 專案文檔

- [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md) - **執行指南**（如何進行）⭐
- [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) - 規劃文件導覽
- [../README.md](../README.md) - docs 總覽
- [line-bot/10_REQUIREMENTS.md](./line-bot/10_REQUIREMENTS.md) - LINE Bot V1.1（MVP 已歸檔）
- [60_completed/phase3-photo-sync-bulk/](../60_completed/phase3-photo-sync-bulk/) - Photo Sync 結案
- [20_guides/photo-sync/runbooks/STORAGE_AUDIT.md](../20_guides/photo-sync/runbooks/STORAGE_AUDIT.md) - 儲存盤點
- [20_guides/infra/upgrades/IMMICH_v2.7.5.md](../20_guides/infra/upgrades/IMMICH_v2.7.5.md) - Server 升級 checklist
- [20_guides/infra/GPU_CONFIGURATION.md](../20_guides/infra/GPU_CONFIGURATION.md) - GPU 配置詳解
- [../60_completed/](../60_completed/) - 已結案專案歸檔

### 外部資源

- [LINE Developers Console](https://developers.line.biz/)
- [Immich Official Docs](https://docs.immich.app/)
- [Immich API Reference](https://docs.immich.app/docs/api)
- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)

---

## 🎯 下一步行動

> 詳細步驟見 [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)

### 本週收尾清單（2026-06-18）

**完成** ✅:

1. **Phase 3.5 Phase B** — bulk export ✅ · import+verify ✅ · delete-source（6/16–17 手動） · iCloud 災難復原 ✅
2. **iCloud 相簿對帳**（PR #24）— 移除 2,155 stale + 補 402 + 還原 9 trash + 上傳 2 → **638/638 對齊**
3. **日期校正** — suspicious 5 + import-mismatch 445 = **450** 筆全修
4. **PR #24 merge + release `73b1d06`** ✅

**待完成** 🚧:

1. **手動還原 23 張**：Recently Deleted 中 1y 內未入 Immich → `recovery/trashed-restore-23.json`
2. **Recently Deleted 永久清除**（288 張 · GUI）→ 釋放 iCloud 配額
3. **local-archive 9 new**：`immich-sync.sh --library local-archive`
4. **reconcile dry-run** 確認 orphan 數量（`immich-reconcile.sh --dry-run`）

**明確 Defer（不計入本輪，以下列入 Backlog）**:

| 項目 | 優先 | 預計 |
|------|------|------|
| Phase 4 PostgreSQL → SSD | P2 | Q3 |
| Phase 5 B2 備份 | P2 | Q3 |
| LINE Bot Grafana / 7 天 SLO | P2 | Q3 |
| LINE Bot V1.1 Qwen vision 繁中描述 | P3 | TBD |
| Similar Images 重複偵測 | P2 Optional | TBD |
| Photo Edit + AI | P3 | TBD |
| `immich-reconcile-diagnose.sh` | P2 | TBD |
| rollback 實測文件 | P2 | TBD |
| tier LaunchAgent / cron | P2 | Phase B 後 |
| fswatch debounce / ignore | P3 | TBD |

**已完成** ✅（近期）:

- **iCloud 災難復原** — 從 Immich 回復 638 張 · 相簿對齊 638/638 · 日期修正 450 筆（2026-06-18）
- **PR #24 merge** `73b1d06` — 新增 immich_import_to_icloud / album_reconcile / fix_dates 工具組（2026-06-18）
- Phase 3.5 Phase B bulk import+verify ✅（staging 0 · 2026-06-18）
- Phase 3.6 reconcile **501** orphan trashed（484 + 17）· dry-run **0**（2026-06-17）
- Phase 3.6 M3 fswatch + Phase B bulk 工具（PR #20 · `d803a19`）
- Phase 3.6 delete reconcile + API upload（PR #19 · `39f8a66`）
- Phase 3.5 M3 第一輪 **1615/1615** export→import→verify（2026-06-14）
- M1 spot-check **100%** Immich dup · M2 跨 library 研究
- infra-bootstrap Immich v2.7.5 K8s **`588ee55`**（Recreate · toleration · Caddy timeout）
- Phase 3 全量 + LaunchAgent 增量 · Immich v2.7.5

---

## ✅ 驗收檢查清單

### Phase 2 完成條件

- [x] **Repo 建立完成**（immich-apps）⭐
- [x] LINE Bot Channel 建立 + Webhook Verify（`https://immich-bot.3q.fi/webhook/line`）
- [x] 1Password 憑證（Immich-LINE-Bot + Immich-API-Key）
- [x] 1Password Operator → K8s Secrets 同步（Helm `OnePasswordItem` · Infra-Platform vault）
- [x] Kubernetes Deployment 健康（Pod Running + `/health` probes pass）
- [x] Ingress TLS 證書正常（`https://immich-bot.3q.fi` · cert-manager Ready）
- [x] 從 LINE 轉發 / 傳送照片可成功上傳（E2E 2026-06-11；imageSet 批次 summary PR #9）
- [x] Immich Web UI 可見新照片 + ML 人臉 pipeline
- [ ] **V1.1** 繁中 AI 描述（Qwen **vision**；非 GPT-4V）— Immich 內建 CLIP / Smart Search 已可用
- [x] Prometheus 指標端點（LINE Bot `GET /metrics` · Helm scrape annotations）
- [ ] Prometheus **scrape 驗證** + Grafana dashboard + 7 天 SLO 告警
- [x] 錯誤處理核心案例（非圖片拒絕、上傳失敗回覆、metadata poll 逾時）
- [ ] 成功率 > 95%（**正式** 7 天監控；實測 E2E 正常）

**Phase 2 核心 MVP**：✅ 可視為 **結案**；剩餘為 V1.1 vision 描述與 Grafana/SLO 運維項。

### Phase 3 完成條件

- [x] Immich CLI 安裝並配置
- [x] 環境變數 / photo-sync.env
- [x] local-archive 全量同步完成
- [x] icloud-primary 全量同步完成
- [x] dry-run 驗收（0 new / 3512 dup icloud；0 new / 5023 dup local）
- [x] Launchd 服務安裝
- [x] 增量同步測試通過（< 5 分鐘）（2026-06-12 LaunchAgent）
- [x] 日誌 + stats JSON 記錄

---

**專案狀態**: ✅ Phase 2/3/3.6 結案 · 🟡 Phase 3.5 收尾（purge + reconcile）  
**當前重點**: 手動還原 23 張 → Recently Deleted purge → local-archive 9 new → reconcile dry-run  
**下一里程碑**: Phase 3.5 結案（目標 2026-06-22）  
**Defer（P2/P3）**: Phase 4 SSD · Phase 5 B2 · LINE V1.1 Grafana · Similar Images · Photo Edit  
**Infra**: immich v2.7.5 K8s 已 merge → `infra-bootstrap` **`588ee55`**

**最後更新**: 2026-06-22  
**維護者**: Infrastructure Team + App Dev Team  
**更新頻率**: Phase 里程碑或全量 sync 階段變更時
