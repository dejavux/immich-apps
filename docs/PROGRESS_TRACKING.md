# Immich Enhancement Project - Progress Tracking (SSOT)

**單一真相來源（Single Source of Truth）**：Immich 增強專案所有任務的集中管理。

> 🏗️ **Repo**: <https://github.com/dejavux/immich-apps>（整合 server + LINE Bot + photo sync）  
> 📋 **執行指南**: [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)

**最後更新**: 2026-06-11（Phase 3 local-archive 全量上傳進行中）  
**專案狀態**: ✅ Phase 2 核心上線；🚧 Phase 3 Photo Sync ~55%  
**負責人**: Infrastructure Team + App Dev Team

---

## 📊 總體狀態

| 指標 | 數值 | 說明 |
|------|------|------|
| 🔴 高優先級任務 | 3 | Phase 2 強化（批次/tag）+ Phase 3 啟動 |
| 🟡 中優先級任務 | 5 | Phase 3 Photo Sync (P1) |
| 🟢 低優先級任務 | 8 | Phase 4-5 優化項目 (P2) |
| ✅ 本週完成 | 18 | PR #7 Photo Sync、cspell lint、LaunchAgent、儲存盤點 |
| 📈 整體進度 | **78%** | Phase 0: 100%, Phase 1: 50%, Phase 2: **85%**, Phase 3: **55%** |

---

## 🎯 Phase 概覽

| Phase | 名稱 | 優先級 | 狀態 | 進度 | 預估完成 |
|-------|------|--------|------|------|----------|
| **Phase 0** | Repo 整合 | ✅ 完成 | 100% | ██████████ 100% | 2026-05-27 |
| **Phase 1** | 基礎設施 | ✅ 已部署 | 50% 完成 | █████░░░░░ 50% | 2025-10-06 |
| **Phase 2** | LINE Bot | 🔴 P0 最高 | ✅ 核心 MVP 上線 | ████████░░ 85% | 2026-06-11 |
| **Phase 3** | Photo Sync | 🟡 P1 | 🚧 上傳中 | █████░░░░░ 55% | 2026-06-28 |
| **Phase 4** | Storage 優化 | 🟢 P2 | 📋 規劃中 | ░░░░░░░░░░ 0% | 2026-07-05 |
| **Phase 5** | Backup 監控 | 🟢 P2 | 📋 規劃中 | ░░░░░░░░░░ 0% | 2026-07-12 |

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
- [x] Helm deploy + 生產 Webhook（見 [PHASE2_K8S_DEPLOYMENT.md](./PHASE2_K8S_DEPLOYMENT.md)）

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

**狀態**: ✅ 完成（2026-06-11）  
**文檔**: [PHASE2_K8S_DEPLOYMENT.md](./PHASE2_K8S_DEPLOYMENT.md) ⭐  
**目前映像**: `registry-internal.3q.fi/immich-line-bot:3abfca8`（Helm revision 6）

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
- [x] P1: photo-sync CLI `--json-output` 統計 — `immich-sync.sh` → `log_dir/stats/*.json`
- [x] P2: 上傳後 poll `hasMetadata`（Bot 回覆拍攝時間 / 人臉）— `waitForAssetMetadata`
- [x] P2: OpenAPI v2.0.1 types — `open-api/` + `npm run openapi:sync`
- [x] P2: Immich server Prometheus（`IMMICH_TELEMETRY_INCLUDE=all`；infra-bootstrap）
- [x] P3: CLIP / metadata 觀察腳本 — `scripts/photo-sync/observe-asset-intelligence.sh`
- [x] P3: XMP sidecar 說明 — `photo-sync.config.yaml.example`
- [ ] P3: Qwen vision 繁中 description（V1.1；叢集 `local-llm/qwen-coder`；Immich CLIP 觀察後再決定）
- [ ] Immich CLIP smart tags 觀察（上傳後數分鐘，用 observe 腳本）

**驗收**: 核心 E2E ✅；進階案例與強化功能待下一迭代

---

### 2.7 監控設定

**狀態**: 🚧 程式碼就緒（PR 待 merge）  
**負責**: SRE Team  
**預估**: 1 小時

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

**狀態**: 🚧 進行中（2026-06-11）

**任務**:

- [x] 更新 `PROGRESS_TRACKING.md`（本文件）
- [x] 更新 `HOW_TO_PROCEED.md`、`PHASE2_K8S_DEPLOYMENT.md`
- [x] infra-bootstrap 指向 + Caddy `immich-bot.3q.fi`
- [ ] infra-bootstrap Caddyfile commit + PR
- [ ] Phase 2 完成報告（可選 `PHASE2_COMPLETION_REPORT.md`）

---

## 🟡 P1：中優先級（Phase 3 - Photo Sync）

**狀態**: 🚧 **進行中**（2026-06-11 開工）  
**目標**: 多個 Mac `.photoslibrary` → Immich（原檔 + EXIF SSOT）  
**預估**: 2-3 天（同步）+ Phase 3.5 分層搬移  
**前置條件**: ✅ Phase 2 核心完成

### 架構決策

| 層 | SSOT | 說明 |
|----|------|------|
| Mac | `.photoslibrary` | iCloud + Local 兩個 library |
| Immich | union + hash dedupe | 兩 library 都 sync，Immich 去重 |
| 分層 | Phase 3.5 | iCloud 超量→Local 需 osxphotos（規劃中） |
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

**狀態**: ✅ 完成（本機）；⏳ credential fix 待 commit PR

**任務**:

- [x] `~/.config/immich-apps/photo-sync.config.yaml`
- [x] 多 library config（icloud-primary + local-archive）
- [x] `tier_policy` 區塊（Phase 3.5 預留）
- [x] LaunchAgent `com.immich.photo-sync.watch`（`install-launchd.sh`）
- [x] `bootstrap-credentials.sh` → `~/.config/immich-apps/photo-sync.env`（減少 1Password 彈窗）
- [x] `ensure-immich-creds.sh` — 略過 `.env` placeholder、優先 photo-sync.env
- [x] `.env` 移除 `IMMICH_API_KEY` placeholder（direnv 不再注入假 key）
- [x] cspell 加入 `make lint`（`.cspell.json`）
- [x] 上述憑證 fix（PR 待 merge）

**驗收**: dry-run ✅；LaunchAgent ✅

---

### 3.2.1 伺服器儲存盤點（2026-06-11）

**狀態**: ✅ 完成  
**文檔**: [PHASE3_STORAGE_AUDIT.md](./PHASE3_STORAGE_AUDIT.md)

**結論**:

- ~112 GB = `upload` 44G + `external-library` 43G×2 + 轉檔 23G + thumbs 2G
- DB ~3143 assets（上傳前）≈ 過去 iCloud/App 子集；**非** LOCAL archive 全量
- LOCAL 5023 檔 vs DB：**0 hash duplicate** → 全量上傳正確
- External library「Migrated photos」：`assetCount: 0` — 磁碟舊副本，upload 完成後可清理

---

### 3.3 初次全量同步

**狀態**: 🚧 **local-archive 上傳中**（2026-06-11 16:38 起）

**任務**:

- [x] dry-run local-archive（5023 new / 0 dup）
- [ ] **local-archive 全量**（~44 GB，進行中；中斷可重跑續傳）
- [ ] icloud-primary 全量（待 local 完成；預期大量 dup）
- [ ] Immich Web UI 抽查 EXIF（Make/Model/Date taken）
- [ ] 清理 external-library 冗餘磁碟（Phase 3 收尾；runbook：[PHASE3_EXTERNAL_LIBRARY_CLEANUP.md](./PHASE3_EXTERNAL_LIBRARY_CLEANUP.md)）

**監控**:

```bash
tail -f ~/Library/Logs/immich-photo-sync/sync.log
# 或 terminal Uploading assets 進度列
```

**續傳**: 重跑 `./scripts/photo-sync/immich-sync.sh --library local-archive`；CLI hash skip 已完成檔。

**驗收**: local + icloud 全量完成；Immich union 完整；hash dedupe 跨 library

---

### 3.4 Launchd 自動啟動

**狀態**: ✅ 已安裝（2026-06-11）

**任務**:

- [x] `com.immich.photo-sync.watch.plist`（`install-launchd.sh`）
- [x] `run-with-op-env.sh` + `photo-sync.env`
- [x] `launchctl bootstrap gui/$(id -u)/com.immich.photo-sync.watch`
- [ ] 增量同步實測（待全量完成後）

**驗收**: LaunchAgent running；增量待驗

---

### 3.5 增量同步測試

**狀態**: ⏳ 待全量完成後

**任務**:

- [ ] 在 Mac Photos 加入新照片
- [ ] 等待 1-5 分鐘
- [ ] 檢查日誌

  ```bash
  tail -f ~/Library/Logs/immich-sync.log
  ```

- [ ] 登入 Immich Web UI 確認新照片出現

**驗收**: 新照片在 5 分鐘內同步到 Immich

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
| 同步延遲 | < 5 min | - | ⏳ 待測試 |
| 上傳成功率 | > 98% | - | ⏳ 待測試 |
| 重複檔案 | 0 | - | ⏳ 待測試 |
| 服務穩定性 | 24/7 運行 | - | ⏳ 待部署 |

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

_目前無開放問題_

---

### 已解決問題

| ID | 問題 | 解決方案 | 解決日期 |
|----|------|----------|----------|
| #1 | lama GPU 是否都給 qwen 了？ | 否，lama 有 4 個 GPU，qwen 只用 1 個 | 2026-05-27 |
| #2 | immich-ml 是否可在不同 node？ | 是，當前在 worker3（與 qwen 隔離） | 2026-05-27 |
| #3 | 優先級不明確 | LINE Bot (P0) > Photo Sync (P1) | 2026-05-27 |

---

## 📚 相關文檔

### 專案文檔

- [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md) - **執行指南**（如何進行）⭐
- [README.md](./README.md) - 專案總覽
- [PHASE2_LINE_BOT.md](./PHASE2_LINE_BOT.md) - LINE Bot 完整實作（P0）
- [PHASE3_PHOTO_SYNC.md](./PHASE3_PHOTO_SYNC.md) - 照片同步實作（P1）
- [GPU_CONFIGURATION.md](./GPU_CONFIGURATION.md) - GPU 配置詳解
- [COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md) - 重構完成總結

### 外部資源

- [LINE Developers Console](https://developers.line.biz/)
- [Immich Official Docs](https://docs.immich.app/)
- [Immich API Reference](https://docs.immich.app/docs/api)
- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)

---

## 🎯 下一步行動

> 詳細步驟見 [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)

### 本週重點（Week 1: 6/10-6/14）

**已完成** ✅:

- [x] LINE Bot Channel + 1Password 憑證
- [x] LINE Bot MVP 源碼（webhook → Immich upload）
- [x] Helm chart 骨架 `deploy/helm/immich-line-bot/`
- [x] K8s 部署規劃 [PHASE2_K8S_DEPLOYMENT.md](./PHASE2_K8S_DEPLOYMENT.md)
- [x] `scripts/dev/pf.sh`（30450）

**進行中** 🚧:

1. **Infra**（Week 2 優先）:
   - [ ] Tekton release pipeline `ci/tekton/release/`
   - [ ] infra-bootstrap: `ci-tenant-immich-apps` bootstrap
   - [ ] Caddy + Route53: `immich-bot.3q.fi` HTTPS
   - [ ] `make release` → BuildKit build + Helm deploy

2. **驗收**:
   - [ ] LINE Webhook Verify Success
   - [ ] E2E：LINE 轉發照片 → Immich 可見

### 下週（Week 2: 6/15-6/21）

- [ ] 首次 `helm upgrade immich-line-bot` + 生產 Webhook
- [ ] Prometheus metrics（V1.1）
- [ ] Phase 2 結案

### Week 3+

- [ ] Phase 3: Photo Sync（Mac launchd）

---

## ✅ 驗收檢查清單

### Phase 2 完成條件

- [x] **Repo 建立完成**（immich-apps）⭐
- [x] LINE Bot Channel 建立（Webhook URL 待部署後 Verify）
- [x] 1Password 憑證（Immich-LINE-Bot + Immich-API-Key）
- [ ] 1Password Operator → K8s Secrets 同步
- [ ] Kubernetes Deployment 健康（Pod Running + probes pass）
- [ ] Ingress TLS 證書正常（<https://immich-bot.3q.fi）>
- [ ] 從 LINE 轉發照片可成功上傳（< 5 秒回覆）
- [ ] Immich Web UI 可見新照片
- [ ] AI 描述自動產生（CLIP + GPT-4V）
- [ ] Prometheus 指標正常收集（/metrics 端點）
- [ ] 錯誤處理測試通過
- [ ] 成功率 > 95%（監控 7 天）

### Phase 3 完成條件

- [ ] Immich CLI 安裝並配置
- [ ] 環境變數設定正確
- [ ] 初次全量同步完成
- [ ] Launchd 服務自動啟動
- [ ] 增量同步測試通過（< 5 分鐘）
- [ ] 日誌記錄正常

---

**專案狀態**: 🚧 Phase 2 — Tekton + HTTPS 部署階段  
**當前重點**: Tekton release pipeline + `immich-bot.3q.fi` HTTPS + Helm 首次部署  
**下一里程碑**: Phase 2 E2E 完成（2026-06-21）

**最後更新**: 2026-06-10  
**維護者**: Infrastructure Team + App Dev Team  
**更新頻率**: 每週（或 Phase 里程碑完成時）
