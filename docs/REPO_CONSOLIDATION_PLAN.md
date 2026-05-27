# Immich Apps - Repo 整合方案

**日期**: 2026-05-27  
**決策**: 將所有 Immich 相關組件整合到單一 repo `immich-apps`

---

## 🎯 核心決策

### 從「LINE Bot 獨立 repo」改為「Immich 完整 Apps Repo」

**原建議**: `immich-line-bot` (僅 LINE Bot)  
**新建議**: `immich-apps` (完整 Immich 生態) ⭐

**理由**:

1. **Immich server 配置也需要版本控制**
   - 雖然用 upstream Helm chart，但有大量自定義（values, secrets, PV）
   - 這些配置不是「基礎設施」，而是「應用配置」

2. **統一管理更合理**
   - LINE Bot 依賴 Immich API
   - Photo Sync 上傳到 Immich
   - 三者是緊密耦合的生態系統

3. **參考 fuqi-asset-manager 模式**
   - fuqi-asset-manager 包含多個微服務（crypto-data, price-service, wallet-service, telegram-bff 等）
   - Immich 也應該是同樣模式（immich-server, line-bot, photo-sync）

4. **CI/CD 統一**
   - 一次部署所有組件
   - 統一的版本號
   - 統一的 Makefile

---

## 📊 對比分析

### 方案 A: 多個獨立 Repo（原建議）❌

```
immich-server/           # 僅配置
immich-line-bot/         # LINE Bot 源碼
immich-photo-sync/       # Photo Sync 腳本
```

**問題**:
- ❌ 配置分散，難以統一管理
- ❌ 需要協調多個 repo 的版本
- ❌ CI/CD 複雜（跨 repo 依賴）
- ❌ 文檔分散

### 方案 B: 單一 Immich Apps Repo（新建議）✅

```
immich-apps/
├── deploy/
│   ├── helm/
│   │   ├── immich-server/          # Immich server (upstream chart wrapper)
│   │   ├── immich-line-bot/        # LINE Bot
│   │   └── immich-photo-sync/      # (未來) Photo Sync CronJob
│   └── manifests/
│       ├── immich-deployment.yaml  # (從 infra-bootstrap 移過來)
│       ├── immich-local-pv.yaml
│       ├── 1password-items.yaml
│       └── ...
├── src/
│   ├── line-bot/                   # LINE Bot TypeScript
│   ├── photo-sync/                 # Photo Sync scripts
│   └── shared/                     # 共用 utilities
├── scripts/
│   ├── dev/
│   │   └── pf.sh                   # Port 30430-30439
│   └── deploy-all.sh               # 部署所有組件
├── docs/
│   ├── PROGRESS_TRACKING.md        # (從 infra-bootstrap 移過來)
│   ├── PHASE2_LINE_BOT.md
│   ├── PHASE3_PHOTO_SYNC.md
│   └── ...
├── Makefile
├── package.json                    # Node.js dependencies (LINE Bot)
└── README.md
```

**優勢**:
- ✅ 統一管理所有 Immich 組件
- ✅ 統一版本控制
- ✅ 統一 CI/CD
- ✅ 文檔集中
- ✅ 參考 fuqi-asset-manager 成功模式

---

## 🏗️ 新 Repo 架構

### 目錄結構

```yaml
immich-apps/
├── deploy/
│   ├── helm/
│   │   ├── immich-server/                    # Immich server
│   │   │   ├── Chart.yaml                    # Wrapper chart
│   │   │   ├── values.yaml                   # 自定義配置
│   │   │   ├── values-dev.yaml
│   │   │   ├── templates/
│   │   │   │   ├── 1password-items.yaml
│   │   │   │   ├── pv-pvc.yaml               # lama hostPath
│   │   │   │   └── metallb-pool.yaml
│   │   │   └── README.md
│   │   │
│   │   ├── immich-line-bot/                  # LINE Bot
│   │   │   ├── Chart.yaml
│   │   │   ├── values.yaml
│   │   │   ├── templates/
│   │   │   │   ├── deployment.yaml
│   │   │   │   ├── service.yaml
│   │   │   │   ├── ingress.yaml
│   │   │   │   └── 1password-items.yaml
│   │   │   └── README.md
│   │   │
│   │   └── immich-photo-sync/                # (未來) Photo Sync
│   │       └── ...
│   │
│   └── manifests/                             # 備用 kubectl manifests
│       ├── immich-deployment.yaml
│       ├── immich-local-pv.yaml
│       └── ...
│
├── src/
│   ├── line-bot/                             # LINE Bot 源碼
│   │   ├── index.ts
│   │   ├── handlers/
│   │   │   ├── line-webhook.ts
│   │   │   ├── immich-upload.ts
│   │   │   └── ai-annotation.ts
│   │   ├── config/
│   │   ├── utils/
│   │   └── types/
│   │
│   ├── photo-sync/                           # Photo Sync 腳本
│   │   ├── immich-sync.sh
│   │   ├── immich-watch.sh
│   │   └── launchd/
│   │       └── com.immich.photosync.plist
│   │
│   └── shared/                               # 共用程式碼
│       ├── immich-client.ts                  # Immich API client
│       └── logger.ts
│
├── scripts/
│   ├── dev/
│   │   └── pf.sh                            # Port-forward (30430-30439)
│   ├── deploy-all.sh                        # 部署所有 Helm charts
│   ├── deploy-immich.sh                     # (從 infra-bootstrap 移過來)
│   └── ...
│
├── docs/
│   ├── README.md                            # 主文檔（從 immich-enhancement 移過來）
│   ├── PROGRESS_TRACKING.md                 # SSOT
│   ├── ARCHITECTURE.md                      # 整體架構
│   ├── PHASE2_LINE_BOT.md
│   ├── PHASE3_PHOTO_SYNC.md
│   ├── GPU_CONFIGURATION.md
│   └── ...
│
├── .github/
│   └── workflows/
│       ├── ci.yml                           # Lint + Test
│       ├── release-line-bot.yml             # LINE Bot release
│       └── release-server.yml               # Immich server release
│
├── Makefile                                  # 統一 Makefile
├── package.json                              # Node.js (LINE Bot)
├── Dockerfile.line-bot                       # LINE Bot image
├── .env.example
└── README.md
```

---

## 📋 從 infra-bootstrap 移動的內容

### 1. Manifests（60_apps/immich/）

**移動到**: `immich-apps/deploy/manifests/`

```bash
# 移動這些檔案:
- immich-deployment.yaml
- immich-loadbalancer.yaml
- immich-ingress.yaml
- immich-local-pv.yaml
- immich-configmap.yaml
- metallb-immich-pool.yaml
- 1password-items.yaml
- deploy-immich.sh
- deploy.yml (Ansible)
```

### 2. 文檔（00_docs/projects/immich-enhancement/）

**移動到**: `immich-apps/docs/`

```bash
# 移動整個目錄:
- README.md
- PROGRESS_TRACKING.md
- PHASE2_LINE_BOT.md
- PHASE3_PHOTO_SYNC.md
- GPU_CONFIGURATION.md
- REPO_ARCHITECTURE_RECOMMENDATION.md
- QUESTIONS_ANSWERED.md
- COMPLETION_SUMMARY.md
```

### 3. infra-bootstrap 保留內容

**60_apps/immich/README.md**（簡化為 directive）:

```markdown
# Immich - 照片管理系統

> ⚠️ **已遷移到獨立 repo**: https://github.com/YOUR_ORG/immich-apps

## 快速連結

- **Repo**: https://github.com/YOUR_ORG/immich-apps
- **文檔**: https://github.com/YOUR_ORG/immich-apps/tree/main/docs
- **部署**: 見獨立 repo 的 `deploy/` 目錄

## 快速部署

```bash
# Clone repo
git clone https://github.com/YOUR_ORG/immich-apps.git
cd immich-apps

# 部署所有組件
make deploy-all

# 或分別部署
make deploy-server    # Immich server
make deploy-line-bot  # LINE Bot
```

## 監控

- Immich Web UI: https://immich.3q.fi
- LINE Bot: https://immich-bot.3q.fi
- Grafana: https://grafana.3q.fi/d/immich

## 相關文檔

- [Living Systems - Immich](../../00_docs/living-systems/applications/immich/)
- [Immich Apps Repo](https://github.com/YOUR_ORG/immich-apps)
```

**00_docs/living-systems/applications/immich/**（保留，更新連結）:

```markdown
# Immich 系統概覽

> 📦 **Repo**: https://github.com/YOUR_ORG/immich-apps
> 📊 **進度追蹤**: https://github.com/YOUR_ORG/immich-apps/blob/main/docs/PROGRESS_TRACKING.md

（保留系統概覽內容，更新所有連結指向新 repo）
```

---

## 🔧 Makefile 設計

```makefile
# immich-apps/Makefile
.PHONY: help lint commit pull_request \
	deploy-all deploy-server deploy-line-bot deploy-sync \
	build-line-bot release-line-bot \
	pf logs test

# Cursor lint-fix-agent 整合
include scripts/cursor-lint-fix-agent-bridge/share/Makefile.lint.mk

help: ## 顯示幫助
	@echo "Immich Apps - 可用命令:"
	@echo ""
	@echo "  開發"
	@echo "  make lint              # 變更檔 lint"
	@echo "  make commit            # Lint + AI commit"
	@echo "  make pull_request      # PR → merge"
	@echo ""
	@echo "  部署（K8s）"
	@echo "  make deploy-all        # 部署所有組件"
	@echo "  make deploy-server     # 部署 Immich server"
	@echo "  make deploy-line-bot   # 部署 LINE Bot"
	@echo "  make deploy-sync       # 部署 Photo Sync"
	@echo ""
	@echo "  Build & Release"
	@echo "  make build-line-bot    # Docker build LINE Bot"
	@echo "  make release-line-bot  # Build + Deploy LINE Bot"
	@echo ""
	@echo "  本機開發"
	@echo "  make pf                # Port-forward (30430-30439)"
	@echo "  make dev-line-bot      # 本機開發 LINE Bot"
	@echo "  make logs              # 查看 k8s logs"

# ═══════════════════════════════════════════════════════════════
# 部署
# ═══════════════════════════════════════════════════════════════

deploy-all: ## 部署所有組件
	@./scripts/deploy-all.sh

deploy-server: ## 部署 Immich server
	helm upgrade --install immich-server ./deploy/helm/immich-server \
		--namespace immich \
		--create-namespace \
		--values ./deploy/helm/immich-server/values.yaml

deploy-line-bot: ## 部署 LINE Bot
	helm upgrade --install immich-line-bot ./deploy/helm/immich-line-bot \
		--namespace immich \
		--values ./deploy/helm/immich-line-bot/values.yaml

deploy-sync: ## 部署 Photo Sync (CronJob)
	helm upgrade --install immich-photo-sync ./deploy/helm/immich-photo-sync \
		--namespace immich \
		--values ./deploy/helm/immich-photo-sync/values.yaml

# ═══════════════════════════════════════════════════════════════
# Build & Release
# ═══════════════════════════════════════════════════════════════

build-line-bot: ## Build LINE Bot Docker image
	docker build -f Dockerfile.line-bot -t registry.3q.fi/immich-line-bot:latest .
	docker push registry.3q.fi/immich-line-bot:latest

release-line-bot: build-line-bot deploy-line-bot ## Build + Deploy LINE Bot

# ═══════════════════════════════════════════════════════════════
# 本機開發
# ═══════════════════════════════════════════════════════════════

pf: ## Port-forward (30430-30439)
	./scripts/dev/pf.sh

dev-line-bot: ## 本機開發 LINE Bot
	cd src/line-bot && npm run dev

logs: ## 查看 k8s logs
	@echo "=== Immich Server ==="
	kubectl logs -n immich -l app=immich-server --tail=50
	@echo ""
	@echo "=== LINE Bot ==="
	kubectl logs -n immich -l app=immich-line-bot --tail=50

# ═══════════════════════════════════════════════════════════════
# Lint & Git
# ═══════════════════════════════════════════════════════════════

lint: cursor-lint-changed ## 變更檔 lint

lint-all: cursor-lint-all ## 全庫 lint

commit: lint ## Lint + AI commit
	./scripts/git-auto-commit.sh

pull_request: commit ## PR → merge
	./scripts/create-pull-request.sh

test: ## 執行測試
	cd src/line-bot && npm test
```

---

## 🚀 實作步驟

### Phase 1: 建立 Repo（今天）

```bash
# 1. 建立 GitHub repo
cd /Users/light0/DEV
gh repo create immich-apps --public --description "Immich complete apps: server + LINE Bot + photo sync"
git clone https://github.com/YOUR_ORG/immich-apps.git
cd immich-apps

# 2. 建立目錄結構
mkdir -p deploy/{helm,manifests}
mkdir -p deploy/helm/{immich-server,immich-line-bot,immich-photo-sync}
mkdir -p src/{line-bot,photo-sync,shared}
mkdir -p scripts/dev
mkdir -p docs
mkdir -p .github/workflows

# 3. 初始化 Node.js (LINE Bot)
npm init -y
npm install express @line/bot-sdk axios form-data pino
npm install -D typescript @types/node @types/express ts-node nodemon

# 4. 建立基礎檔案
touch Makefile
touch Dockerfile.line-bot
touch .env.example
touch README.md
```

### Phase 2: 移動內容（今天）

```bash
# 1. 從 infra-bootstrap 複製 manifests
cp -r /Users/light0/DEV/infra/infra-bootstrap/60_apps/immich/*.yaml \
     /Users/light0/DEV/immich-apps/deploy/manifests/
cp /Users/light0/DEV/infra/infra-bootstrap/60_apps/immich/deploy-immich.sh \
   /Users/light0/DEV/immich-apps/scripts/

# 2. 從 infra-bootstrap 複製文檔
cp -r /Users/light0/DEV/infra/infra-bootstrap/00_docs/projects/immich-enhancement/* \
     /Users/light0/DEV/immich-apps/docs/

# 3. Git commit
cd /Users/light0/DEV/immich-apps
git add .
git commit -m "Initial migration from infra-bootstrap"
git push
```

### Phase 3: 更新 infra-bootstrap（今天）

```bash
# 1. 簡化 60_apps/immich/README.md 為 directive
# 2. 更新 00_docs/living-systems/applications/immich/ 連結
# 3. 保留 00_docs/projects/immich-enhancement/ 但加上「已遷移」標記
```

### Phase 4: 加入 Workspace（今天）

```bash
# 在 Cursor 中加入新 workspace folder
# File → Add Folder to Workspace...
# 選擇 /Users/light0/DEV/immich-apps
```

---

## 🤔 Workspace 數量考量

**當前 Workspace**:
1. infra-bootstrap（基礎設施）
2. fuqi-asset-manager（應用）
3. ibkr-portfolio-miniapp（應用）

**加入 immich-apps 後**:
4. immich-apps（應用）

**是否過多？**

❌ **不會**！理由：

1. **功能清晰分離**
   - infra-bootstrap: 基礎設施（k8s, Ansible, monitoring）
   - fuqi-asset-manager: 資產管理應用
   - ibkr-portfolio-miniapp: 投資組合應用
   - immich-apps: 照片管理應用

2. **參考業界實踐**
   - 多個相關 repo 在同一個 workspace 是常見模式
   - VSCode/Cursor 支援 multi-root workspace
   - 便於跨 repo 搜尋和參考

3. **實際需求**
   - 開發 LINE Bot 時需要參考 fuqi-asset-manager 的結構
   - 部署時需要參考 infra-bootstrap 的配置
   - 統一的開發環境

**建議**: ✅ 加入 immich-apps 到 workspace

---

## ✅ 優勢總結

### 方案 B（單一 immich-apps repo）優勢

| 維度 | 優勢 |
|------|------|
| **管理** | 統一版本控制，一個 repo 管理所有組件 |
| **部署** | `make deploy-all` 一次部署所有服務 |
| **開發** | 共用程式碼（Immich API client, logger） |
| **文檔** | 集中管理，易於維護 |
| **CI/CD** | 統一 pipeline，自動化測試 |
| **Port Range** | 30430-30439 統一分配 |
| **Workspace** | 4 個 repo 合理（不過多） |

---

## 📚 參考

- **fuqi-asset-manager**: 多微服務單一 repo 成功案例
- **REPO_ARCHITECTURE_RECOMMENDATION.md**: 原始架構建議（需更新）

---

**結論**: ✅ 建立 `immich-apps` 統一 repo，整合所有 Immich 組件

**最後更新**: 2026-05-27  
**負責人**: Infrastructure Team + App Dev Team
