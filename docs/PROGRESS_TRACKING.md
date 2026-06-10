# Immich Enhancement Project - Progress Tracking (SSOT)

**單一真相來源（Single Source of Truth）**：Immich 增強專案所有任務的集中管理。

> 🏗️ **Repo**: https://github.com/dejavux/immich-apps（整合 server + LINE Bot + photo sync）  
> 📋 **執行指南**: [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md)

**最後更新**: 2026-06-10  
**專案狀態**: 🚧 Phase 2 開發中 — Repo 就緒，LINE Bot 待實作  
**負責人**: Infrastructure Team + App Dev Team

---

## 📊 總體狀態

| 指標 | 數值 | 說明 |
|------|------|------|
| 🔴 高優先級任務 | 7 | Phase 2 LINE Bot (P0) — repo 已建，剩開發/部署 |
| 🟡 中優先級任務 | 5 | Phase 3 Photo Sync (P1) |
| 🟢 低優先級任務 | 8 | Phase 4-5 優化項目 (P2) |
| ✅ 本週完成 | 4 | Repo 建立、文檔遷移、port 規劃、infra 清理 |
| 📈 整體進度 | **25%** | Phase 0: 100%, Phase 1: 50%, Phase 2: 10% |

---

## 🎯 Phase 概覽

| Phase | 名稱 | 優先級 | 狀態 | 進度 | 預估完成 |
|-------|------|--------|------|------|----------|
| **Phase 0** | Repo 整合 | ✅ 完成 | 100% | ██████████ 100% | 2026-05-27 |
| **Phase 1** | 基礎設施 | ✅ 已部署 | 50% 完成 | █████░░░░░ 50% | 2025-10-06 |
| **Phase 2** | LINE Bot | 🔴 P0 最高 | 🚧 開發中 | ██░░░░░░░░ 10% | 2026-06-21 |
| **Phase 3** | Photo Sync | 🟡 P1 次優先 | 📋 規劃完成 | ░░░░░░░░░░ 0% | 2026-06-28 |
| **Phase 4** | Storage 優化 | 🟢 P2 | 📋 規劃中 | ░░░░░░░░░░ 0% | 2026-07-05 |
| **Phase 5** | Backup 監控 | 🟢 P2 | 📋 規劃中 | ░░░░░░░░░░ 0% | 2026-07-12 |

---

## 🔴 P0：高優先級（Phase 2 - LINE Bot）

**目標**: 從 LINE 轉發照片 → 自動上傳 Immich + AI 標註  
**預估**: 3-5 天（開發）+ 1 天（部署驗收）  
**截止**: 2026-06-21

> 🏗️ **Repo**: `immich-apps` — https://github.com/dejavux/immich-apps  
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
- [ ] 設定 pf.sh (port 30450) — **下一步**
- [ ] 建立 `.github/workflows/` (ci.yml, release.yml)
- [ ] `npm install` + 本機可跑

**驗收**: ✅ Repo 建立完成；⏳ pf.sh / CI 待補

---

### 2.1 LINE Bot Channel 設定

**狀態**: ⏳ 待執行  
**負責**: Ops Team  
**預估**: 30 分鐘

**任務**:

- [ ] 前往 [LINE Developers Console](https://developers.line.biz/)
- [ ] Create Provider (如果還沒有)
- [ ] Create Channel → Messaging API
  - [ ] Channel name: `Immich Photo Bot`
  - [ ] Channel description: `自動上傳照片到 Immich`
  - [ ] Category: Utilities
- [ ] 設定 Webhook URL: `https://immich-bot.3q.fi/webhook/line`
- [ ] 啟用 "Use webhook"
- [ ] 關閉 "Auto-reply messages"
- [ ] 關閉 "Greeting messages"
- [ ] 記錄 Channel Secret（Basic settings）
- [ ] 產生並記錄 Channel Access Token（Messaging API → Issue）

**驗收**: Channel 建立完成，Webhook URL 已設定

---

### 2.2 1Password 憑證設定

**狀態**: ⏳ 待執行  
**負責**: Ops Team  
**預估**: 15 分鐘

**任務**:

- [ ] 在 1Password `Infra-Apps` vault 建立 3 個 items:
  
  **Item 1: Immich-LINE-Bot**
  - [ ] Title: `Immich-LINE-Bot`
  - [ ] Fields:
    - [ ] `channel-secret`: <從 LINE Console 複製>
    - [ ] `access-token`: <從 LINE Console 複製>
  
  **Item 2: Immich-API-Key**
  - [ ] Title: `Immich-API-Key`
  - [ ] 登入 Immich Web UI: `https://immich.3q.fi`
  - [ ] Settings → API Keys → Create API Key
  - [ ] Name: `LINE Bot`
  - [ ] Fields:
    - [ ] `api-key`: <從 Immich 複製>
  
  **Item 3: OpenAI-API-Key**
  - [ ] Title: `OpenAI-API-Key`
  - [ ] 登入 [OpenAI Platform](https://platform.openai.com/)
  - [ ] API keys → Create new secret key
  - [ ] Name: `Immich LINE Bot`
  - [ ] Fields:
    - [ ] `api-key`: <從 OpenAI 複製>

**驗收**: 3 個 1Password items 建立完成，可在 Desktop App 看到

---

### 2.3 開發環境設定

**狀態**: ⏳ 待執行  
**負責**: Dev Team  
**預估**: 1 小時

**任務**:

- [ ] 建立專案目錄結構
  ```bash
  mkdir -p immich-line-bot/src/{handlers,config,utils,types}
  cd immich-line-bot
  ```

- [ ] 初始化 Node.js 專案
  ```bash
  npm init -y
  npm install express @line/bot-sdk axios form-data pino prom-client
  npm install -D typescript @types/node @types/express ts-node nodemon
  ```

- [ ] 設定 TypeScript
  - [ ] 建立 `tsconfig.json`
  - [ ] 設定 `"target": "ES2022"`, `"module": "commonjs"`

- [ ] 建立核心檔案（參考 PHASE2_LINE_BOT.md）:
  - [ ] `src/index.ts` (Express server)
  - [ ] `src/config/environment.ts`
  - [ ] `src/handlers/line-webhook.ts`
  - [ ] `src/handlers/immich-upload.ts`
  - [ ] `src/handlers/ai-annotation.ts`
  - [ ] `src/utils/logger.ts`
  - [ ] `src/utils/metrics.ts`
  - [ ] `src/utils/retry.ts`

- [ ] 建立 Dockerfile
- [ ] 設定本地環境變數（.env.local）

**驗收**: 本地 `npm run dev` 可啟動，`/health` 端點正常

---

### 2.4 本地功能測試

**狀態**: ⏳ 待執行  
**負責**: Dev Team  
**預估**: 2 小時

**任務**:

- [ ] LINE Webhook 驗證
  - [ ] 使用 ngrok 暴露本地端口
  - [ ] LINE Console 設定 ngrok URL
  - [ ] 發送測試訊息，檢查 webhook 接收

- [ ] Immich API 上傳測試
  - [ ] 測試 `/api/asset/upload` 端點
  - [ ] 驗證圖片成功上傳
  - [ ] 檢查 Asset ID 回傳

- [ ] ML 處理等待測試
  - [ ] 輪詢 Asset status
  - [ ] 驗證 CLIP 處理完成

- [ ] GPT-4V 標註測試
  - [ ] 測試 OpenAI Vision API
  - [ ] 驗證繁體中文描述生成
  - [ ] 檢查 token 消耗

- [ ] Metadata 更新測試
  - [ ] 測試 PUT `/api/asset/:id`
  - [ ] 驗證描述和標籤更新

**驗收**: 完整流程從 LINE 發送照片 → Immich 可見 + 有 AI 描述

---

### 2.5 Kubernetes 部署

**狀態**: ⏳ 待執行  
**負責**: DevOps Team  
**預估**: 1 小時

**任務**:

- [ ] 建立 Docker Image
  ```bash
  docker build -t registry.3q.fi/immich-line-bot:v0.1.0 .
  docker push registry.3q.fi/immich-line-bot:v0.1.0
  ```

- [ ] 部署 1Password Items
  ```bash
  cd 60_apps/immich/line-bot
  kubectl apply -f 1password-items.yaml
  ```

- [ ] 等待 Secrets 同步（~60 秒）
  ```bash
  kubectl get secret -n immich | grep -E "line-bot|immich-api|openai"
  ```

- [ ] 部署 Deployment + Service
  ```bash
  kubectl apply -f deployment.yaml
  ```

- [ ] 部署 Ingress
  ```bash
  kubectl apply -f ingress.yaml
  ```

- [ ] 檢查 Pod 狀態
  ```bash
  kubectl get pods -n immich -l app=immich-line-bot
  kubectl logs -n immich -l app=immich-line-bot --tail=50
  ```

- [ ] 驗證 Ingress TLS
  ```bash
  curl -I https://immich-bot.3q.fi/health
  ```

**驗收**: 2/2 Pods Running, Ingress 有有效 TLS 證書

---

### 2.6 生產環境測試

**狀態**: ⏳ 待執行  
**負責**: QA Team  
**預估**: 1 小時

**任務**:

- [ ] 加入 LINE Bot 好友
  - [ ] 從 LINE Developers Console 掃描 QR Code

- [ ] 功能測試
  - [ ] 轉發 1 張照片 → 驗證成功上傳
  - [ ] 檢查回覆訊息（< 5 秒）
  - [ ] 登入 Immich Web UI 確認照片存在
  - [ ] 驗證 AI 描述（CLIP + GPT-4V）
  - [ ] 檢查 EXIF GPS 反向地理編碼

- [ ] 壓力測試
  - [ ] 連續轉發 10 張照片
  - [ ] 檢查成功率
  - [ ] 驗證沒有重複上傳

- [ ] 錯誤處理測試
  - [ ] 發送非圖片訊息 → 驗證忽略
  - [ ] 網絡中斷場景 → 驗證重試
  - [ ] 大圖片（> 10MB）→ 驗證處理

**驗收**: 成功率 > 95%, P95 延遲 < 5 秒

---

### 2.7 監控設定

**狀態**: ⏳ 待執行  
**負責**: SRE Team  
**預估**: 1 小時

**任務**:

- [ ] 驗證 Prometheus 指標
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

**狀態**: ⏳ 待執行  
**負責**: Tech Writer  
**預估**: 30 分鐘

**任務**:

- [ ] 更新 `60_apps/immich/line-bot/README.md`
  - [ ] 加入實際部署日期
  - [ ] 更新 Webhook URL（如果不同）
  - [ ] 加入監控 Dashboard 連結

- [ ] 更新 `PROGRESS_TRACKING.md` (本文件)
  - [ ] Phase 2 標記為完成
  - [ ] 記錄實際完成日期
  - [ ] 更新下一步為 Phase 3

- [ ] 建立 Phase 2 完成報告
  - [ ] 在 `00_docs/projects/immich-enhancement/` 建立 `PHASE2_COMPLETION_REPORT.md`
  - [ ] 記錄成功指標（成功率、延遲等）
  - [ ] 遇到的問題與解決方案
  - [ ] 經驗教訓

**驗收**: 所有文檔更新完成，Phase 2 標記為已完成

---

## 🟡 P1：中優先級（Phase 3 - Photo Sync）

**目標**: Mac Photos Library 自動同步到 Immich  
**預估**: 2-3 天  
**前置條件**: Phase 2 完成  
**截止**: 2026-06-04

### 3.1 安裝依賴

**狀態**: ⏳ 待執行  
**負責**: Dev Team  
**預估**: 15 分鐘

**任務**:

- [ ] 安裝 Immich CLI
  ```bash
  npm install -g @immich/cli
  immich --version
  ```

- [ ] 安裝 fswatch
  ```bash
  brew install fswatch
  fswatch --version
  ```

**驗收**: 兩個工具安裝成功，版本正常顯示

---

### 3.2 腳本設定

**狀態**: ⏳ 待執行  
**負責**: Dev Team  
**預估**: 1 小時

**任務**:

- [ ] 建立腳本目錄
  ```bash
  mkdir -p ~/scripts ~/Library/Logs
  ```

- [ ] 建立 `~/scripts/immich-sync.sh`（參考 PHASE3_PHOTO_SYNC.md）
- [ ] 建立 `~/scripts/immich-watch.sh`
- [ ] 設定執行權限
  ```bash
  chmod +x ~/scripts/immich-sync.sh
  chmod +x ~/scripts/immich-watch.sh
  ```

- [ ] 設定環境變數
  ```bash
  # ~/.zshrc
  export IMMICH_INSTANCE_URL=https://immich.3q.fi
  export IMMICH_API_KEY=<from Immich Web UI>
  ```

**驗收**: 腳本可手動執行，環境變數正確設定

---

### 3.3 初次全量同步

**狀態**: ⏳ 待執行  
**負責**: Ops Team  
**預估**: 視照片數量（建議夜間執行）

**任務**:

- [ ] 執行初次同步
  ```bash
  ~/scripts/immich-sync.sh
  ```

- [ ] 監控日誌
  ```bash
  tail -f ~/Library/Logs/immich-sync.log
  ```

- [ ] 驗證上傳完成
  - [ ] 登入 Immich Web UI
  - [ ] 檢查照片數量
  - [ ] 隨機抽查照片完整性

**驗收**: 所有照片成功上傳，無重複，無遺漏

---

### 3.4 Launchd 自動啟動

**狀態**: ⏳ 待執行  
**負責**: Dev Team  
**預估**: 30 分鐘

**任務**:

- [ ] 建立 `~/Library/LaunchAgents/com.user.immich-watch.plist`
- [ ] 修改 plist 中的 USERNAME 和 API_KEY
- [ ] 載入服務
  ```bash
  launchctl load ~/Library/LaunchAgents/com.user.immich-watch.plist
  ```

- [ ] 檢查服務狀態
  ```bash
  launchctl list | grep immich
  ```

**驗收**: 服務自動啟動，重啟 Mac 後仍運行

---

### 3.5 增量同步測試

**狀態**: ⏳ 待執行  
**負責**: QA Team  
**預估**: 30 分鐘

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

**可並行 — Ops 軌 + Dev 軌**:

1. **Ops**（約 1 小時）:
   - [ ] LINE Bot Channel 設定
   - [ ] 1Password 憑證（Immich-LINE-Bot, Immich-API-Key, OpenAI-API-Key）
   - [ ] 確認 `immich-bot.3q.fi` DNS / Ingress

2. **Dev**（2-3 天）:
   - [ ] `npm install`
   - [ ] `src/line-bot/index.ts` — Express + /health + webhook
   - [ ] `scripts/dev/pf.sh`（port 30450）
   - [ ] Immich upload client（`src/shared/immich-client.ts`）

3. **Deploy**（Week 2）:
   - [ ] Helm chart `deploy/helm/immich-line-bot/`
   - [ ] `make build-line-bot` + `make deploy-line-bot`
   - [ ] E2E：LINE 轉發照片 → Immich 可見

### 下週（Week 2: 6/15-6/21）

- [ ] 生產驗收 + Prometheus metrics
- [ ] Phase 2 結案

### Week 3+

- [ ] Phase 3: Photo Sync（Mac launchd）

---

## ✅ 驗收檢查清單

### Phase 2 完成條件

- [x] **Repo 建立完成**（immich-apps）⭐
- [ ] LINE Bot Channel 建立並設定 Webhook
- [ ] 1Password 憑證同步正常（3 個 Secrets）
- [ ] Kubernetes Deployment 健康（2/2 Pods Running）
- [ ] Ingress TLS 證書正常（https://immich-bot.3q.fi）
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

**專案狀態**: 🚧 Phase 2 開發中（Week 1）  
**當前重點**: Ops 憑證 + LINE Bot MVP 源碼  
**下一里程碑**: Phase 2 E2E 完成（2026-06-21）

**最後更新**: 2026-06-10  
**維護者**: Infrastructure Team + App Dev Team  
**更新頻率**: 每週（或 Phase 里程碑完成時）
