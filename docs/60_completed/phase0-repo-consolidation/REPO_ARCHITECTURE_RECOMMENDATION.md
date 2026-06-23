# Immich LINE Bot - Repo 管理與架構建議

**日期**: 2026-05-27  
**問題**: LINE Bot 源碼位置、Helm 部署、port-forward、lint/CI 整合  
**結論**: **建議建立獨立 repo `immich-line-bot`**

---

## 📊 當前架構分析

### 現有 Repo 結構

| Repo | 類型 | 內容 | Port Range | Makefile | PROGRESS_TRACKING |
| ------ | ------ | ------ | ------------ | ---------- | ------------------- |
| **fuqi-asset-manager** | 應用 repo | src/ + deploy/helm/ | 30400-30410 | ✅ 完整 | ✅ 獨立 |
| **grid-bot-v3** | 應用 repo | src/ + deploy/ | (獨立) | ✅ 完整 | ✅ 獨立 |
| **ibkr-portfolio-miniapp** | 應用 repo | src/ + deploy/ | (獨立) | ✅ 完整 | ✅ 獨立 |
| **infra-bootstrap** | 基礎設施 | 60_apps/ (manifests) | 30420-30421 | ✅ infra 專用 | ✅ infra 專用 |

### pf.sh Port Range 對照

```yaml
# fuqi-asset-manager/scripts/dev/pf.sh
30400: crypto-data-service
30401: price-service
30402: wallet-service
30403: bridge-worker
30404: prometheus
30405: grafana
30408: 1password-connect
30409: telegram-notify
30410: telegram-bff

# infra-bootstrap/scripts/dev/pf.sh
30420: local-llm (qwen-coder)
30421: docker-registry

# 可用 range（建議）
30430-30439: immich-line-bot 及相關服務
```

---

## ✅ 建議方案：建立獨立 Repo

### 方案 A: 獨立 Repo（推薦）⭐

**Repo 名稱**: `immich-line-bot`

**理由**:

1. **源碼管理**:
   - LINE Bot 有完整的 TypeScript 源碼（src/）
   - 需要獨立的 npm dependencies
   - 需要獨立的版本控制

2. **CI/CD 獨立**:
   - 有自己的 lint/test/build pipeline
   - 不影響 infra-bootstrap 的 CI
   - 可以獨立 release

3. **團隊協作**:
   - 應用開發團隊 vs 基礎設施團隊
   - 不同的 commit 頻率和 release cycle
   - 獨立的 PR 審查流程

4. **參考先例**:
   - fuqi-asset-manager（應用 repo）
   - grid-bot-v3（應用 repo）
   - infra-bootstrap 僅管理基礎設施

---

### 方案 B: Monorepo（不推薦）❌

**放在**: `infra-bootstrap/60_apps/immich-line-bot/`

**問題**:

1. ❌ **混淆關注點**: infra-bootstrap 是基礎設施 repo，不應包含應用源碼
2. ❌ **Makefile 衝突**: 應用的 `make lint` vs infra 的 `make lint-ansible`
3. ❌ **CI 耦合**: 應用變更會觸發整個 infra-bootstrap CI
4. ❌ **版本管理**: 應用版本 vs infra 版本混在一起
5. ❌ **PROGRESS_TRACKING 混亂**: 應用進度 vs infra 進度在同一個文件

---

## 🏗️ 推薦架構（方案 A）

### Repo 結構

```yaml
immich-line-bot/                           # 新建獨立 repo
├── src/
│   ├── index.ts                           # Express server
│   ├── handlers/
│   │   ├── line-webhook.ts
│   │   ├── immich-upload.ts
│   │   └── ai-annotation.ts
│   ├── config/
│   ├── utils/
│   └── types/
├── deploy/
│   └── helm/
│       └── immich-line-bot/
│           ├── Chart.yaml
│           ├── values.yaml
│           ├── values-dev.yaml
│           ├── templates/
│           │   ├── deployment.yaml
│           │   ├── service.yaml
│           │   ├── ingress.yaml
│           │   └── 1password-items.yaml
│           └── README.md
├── scripts/
│   ├── dev/
│   │   └── pf.sh                         # Port 30430
│   └── deploy.sh
├── tests/
├── docs/
│   ├── PROGRESS_TRACKING.md              # 獨立的進度追蹤
│   └── ARCHITECTURE.md
├── .github/
│   └── workflows/
│       ├── ci.yml                        # Lint + Test
│       └── release.yml                   # Build + Deploy
├── Makefile                               # 完整的 lint/commit/release
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

### infra-bootstrap 保留

```yaml
infra-bootstrap/
└── 60_apps/immich/
    ├── README.md                          # 指向 immich-line-bot repo
    ├── immich-deployment.yaml             # Immich server (保留)
    ├── immich-local-pv.yaml
    ├── ...
    └── line-bot/
        ├── README.md                      # 簡短說明 + 指向獨立 repo
        └── kustomization.yaml             # (可選) Kustomize overlay
```

---

## 📝 實作細節

### 1. Port Range 分配

```yaml
# immich-line-bot/scripts/dev/pf.sh
PF_LOCAL_LINE_BOT_PORT="${PF_LOCAL_LINE_BOT_PORT:-30430}"

register_tunnel() {
  register_tunnel line-bot "Immich LINE Bot" "$PF_LOCAL_LINE_BOT_PORT" 3000 \
    immich-line-bot /health LINE_BOT_URL "http://127.0.0.1:${PF_LOCAL_LINE_BOT_PORT}" 0
}

# 用法:
./scripts/dev/pf.sh
# 輸出: Port-forward: immich-line-bot → 127.0.0.1:30430
```

**Port Range 總覽**:

| Service | Port | Repo |
| --------- | ------ | ------ |
| fuqi-asset-manager | 30400-30410 | fuqi-asset-manager |
| infra-apps | 30420-30429 | infra-bootstrap |
| **immich-line-bot** | **30430-30439** | **immich-line-bot** |
| (預留) | 30440+ | 未來服務 |

---

### 2. Makefile 整合

```makefile
# immich-line-bot/Makefile
.PHONY: help lint lint-all lint-mechanical commit pull_request \
 build deploy release test dev logs

# Cursor lint-fix-agent 整合（與 fuqi-asset-manager 相同）
LINT_TARGET_PREFIX := cursor-
HOME_CURSOR_LINT_AGENT_SH := $(HOME)/workspace/cursor-lint-fix-agent/share/lint_fix_agent.sh
LOCAL_CURSOR_LINT_AGENT_SH := $(abspath scripts/cursor-lint-fix-agent-bridge/share/lint_fix_agent.sh)
ifeq ($(wildcard $(HOME_CURSOR_LINT_AGENT_SH)),)
export LINT_FIX_AGENT_SH := $(LOCAL_CURSOR_LINT_AGENT_SH)
else
export LINT_FIX_AGENT_SH := $(HOME_CURSOR_LINT_AGENT_SH)
endif
LINT_CHAIN_AFTER :=
LINT_CHAIN_AFTER_CHANGED :=
include $(abspath scripts/cursor-lint-fix-agent-bridge/share/Makefile.lint.mk)

help: ## 顯示幫助
 @echo "Immich LINE Bot - 可用命令:"
 @echo ""
 @echo "  make lint              # 變更檔 lint"
 @echo "  make lint-all          # 全庫 lint"
 @echo "  make commit            # lint + AI commit"
 @echo "  make pull_request      # lint → commit → PR → merge"
 @echo "  make build             # Docker build"
 @echo "  make deploy            # Helm deploy to k8s"
 @echo "  make release           # build + deploy"
 @echo "  make dev               # 本機開發 (npm run dev)"
 @echo "  make test              # 執行測試"
 @echo "  make pf                # Port-forward (30430)"

lint: cursor-lint-changed ## 變更檔 lint（Cursor SDK + ESLint）

lint-all: cursor-lint-all ## 全庫 lint

lint-mechanical: ## 變更檔 lint（無 Cursor SDK）
 ./scripts/lint-changed-files.sh

commit auto-commit: lint ## Lint + AI commit
 ./scripts/git-auto-commit.sh

pull_request: commit ## Lint → commit → PR → merge
 ./scripts/create-pull-request.sh

build: ## Docker build
 docker build -t registry.3q.fi/immich-line-bot:latest .
 docker push registry.3q.fi/immich-line-bot:latest

deploy: ## Helm deploy
 helm upgrade --install immich-line-bot ./deploy/helm/immich-line-bot \
  --namespace immich \
  --create-namespace \
  --values ./deploy/helm/immich-line-bot/values.yaml

release: build deploy ## Build + Deploy

dev: ## 本機開發
 npm run dev

test: ## 執行測試
 npm test

pf: ## Port-forward (30430)
 ./scripts/dev/pf.sh

logs: ## 查看 k8s logs
 kubectl logs -n immich -l app=immich-line-bot --tail=100 -f
```

---

### 3. CI/CD 整合

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: immich-line-bot:${{ github.sha }}
```

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            registry.3q.fi/immich-line-bot:latest
            registry.3q.fi/immich-line-bot:${{ github.ref_name }}
      
      - name: Deploy to K8s
        run: |
          helm upgrade --install immich-line-bot ./deploy/helm/immich-line-bot \
            --namespace immich \
            --set image.tag=${{ github.ref_name }}
```

---

### 4. PROGRESS_TRACKING 管理

**每個 repo 有自己的 PROGRESS_TRACKING.md**:

```yaml
# immich-line-bot/docs/PROGRESS_TRACKING.md
專案: Immich LINE Bot
任務: 
  - [ ] TypeScript 實作
  - [ ] Helm chart 建立
  - [ ] CI/CD 設定
  ...

# infra-bootstrap/00_docs/planning/PROGRESS_TRACKING.md
專案: infra-bootstrap 整體
任務:
  - [ ] Kubernetes 叢集升級
  - [ ] Monitoring 優化
  - [ ] 1Password 整合
  ...（不包含 LINE Bot 進度）
```

**跨 repo 追蹤（可選）**:

```yaml
# infra-bootstrap/00_docs/projects/immich-enhancement/PROGRESS_TRACKING.md
# 改為「專案概覽」，指向各 repo:

Phase 2: LINE Bot
  狀態: 進行中
  Repo: https://github.com/user/immich-line-bot
  進度追蹤: 見該 repo 的 PROGRESS_TRACKING.md
  當前狀態: ⏳ 開發中

Phase 3: Photo Sync
  狀態: 規劃中
  實作: 在 Mac 本機（無 repo）
  ...
```

---

## 🚀 實作步驟

### Step 1: 建立新 Repo

```bash
# 1. 建立 GitHub repo
gh repo create immich-line-bot --public --description "LINE Bot for Immich photo auto-upload"

# 2. Clone 並初始化
git clone https://github.com/YOUR_ORG/immich-line-bot.git
cd immich-line-bot

# 3. 複製結構範本（從 fuqi-asset-manager 參考）
mkdir -p src/{handlers,config,utils,types}
mkdir -p deploy/helm/immich-line-bot/templates
mkdir -p scripts/dev
mkdir -p tests docs

# 4. 初始化 Node.js
npm init -y
npm install express @line/bot-sdk axios form-data pino prom-client
npm install -D typescript @types/node @types/express ts-node nodemon

# 5. 建立基礎檔案
touch src/index.ts
touch Dockerfile
touch Makefile
touch .env.example
touch README.md
```

### Step 2: 從規劃文檔轉移

```bash
# 從 infra-bootstrap 複製相關文檔
cp /path/to/infra-bootstrap/00_docs/projects/immich-enhancement/PHASE2_LINE_BOT.md \
   immich-line-bot/docs/IMPLEMENTATION.md

# 建立獨立的 PROGRESS_TRACKING
# (基於 PHASE2_LINE_BOT.md 的任務清單)
```

### Step 3: 設定 Helm Chart

```bash
cd immich-line-bot/deploy/helm/immich-line-bot

# 複製 templates 從 PHASE2_LINE_BOT.md
# (deployment.yaml, service.yaml, ingress.yaml, 1password-items.yaml)

helm lint .
```

### Step 4: 設定 pf.sh

```bash
# immich-line-bot/scripts/dev/pf.sh
# (參考 fuqi-asset-manager/scripts/dev/pf.sh)
# Port: 30430

chmod +x scripts/dev/pf.sh
./scripts/dev/pf.sh  # 測試
```

### Step 5: 設定 CI/CD

```bash
mkdir -p .github/workflows
# 建立 ci.yml, release.yml
```

### Step 6: 更新 infra-bootstrap 引用

```bash
cd /path/to/infra-bootstrap/60_apps/immich/line-bot

# README.md
echo "# Immich LINE Bot

**Repo**: https://github.com/YOUR_ORG/immich-line-bot

此目錄保留為 reference。實際開發請到獨立 repo。

## 快速部署

\`\`\`bash
# 從 immich-line-bot repo
make deploy
\`\`\`
" > README.md
```

---

## 📊 對比總結

| 項目 | 方案 A: 獨立 Repo | 方案 B: Monorepo |
| ------ | ------------------- | ------------------ |
| **源碼管理** | ✅ 清晰獨立 | ❌ 混在 60_apps |
| **CI/CD** | ✅ 獨立 pipeline | ❌ 耦合 infra CI |
| **Makefile** | ✅ 應用專用 | ❌ 與 infra 衝突 |
| **PROGRESS_TRACKING** | ✅ 獨立追蹤 | ❌ 混在 infra 進度 |
| **Port Range** | ✅ 30430 (獨立) | ⚠️ 需協調 |
| **版本管理** | ✅ 獨立版本號 | ❌ 跟隨 infra 版本 |
| **團隊協作** | ✅ 應用團隊獨立 | ❌ infra 團隊混合 |
| **參考先例** | ✅ fuqi-asset-manager | ❌ 無先例 |

**結論**: **強烈推薦方案 A（獨立 Repo）** ⭐

---

## 🎯 下一步行動

### 立即執行（今天）

1. **建立 GitHub Repo**

   ```bash
   gh repo create immich-line-bot --public
   ```

2. **初始化專案結構**

   ```bash
   cd immich-line-bot
   npm init -y
   mkdir -p src deploy/helm scripts/dev docs
   ```

3. **轉移規劃文檔**
   - 將 `PHASE2_LINE_BOT.md` → `docs/IMPLEMENTATION.md`
   - 建立 `docs/PROGRESS_TRACKING.md`

### 本週內

1. **實作核心功能**（參考 PHASE2_LINE_BOT.md）
2. **設定 Helm Chart**
3. **設定 CI/CD**
4. **設定 pf.sh** (port 30430)

### 更新 infra-bootstrap

1. **更新引用**
   - `60_apps/immich/line-bot/README.md` → 指向新 repo
   - `00_docs/projects/immich-enhancement/README.md` → 加入 repo 連結
   - `PROGRESS_TRACKING.md` → 簡化為概覽，指向各 repo

---

## 📚 參考資源

- **fuqi-asset-manager**: `/Users/light0/DEV/fuqi-asset-manager/`
  - Makefile 結構
  - Helm charts 結構
  - pf.sh (30400-30410)
  - CI/CD workflows

- **grid-bot-v3**: `/Users/light0/DEV/grid-bot-v3/`
  - 獨立應用 repo 範例

- **infra-bootstrap**: `/Users/light0/DEV/infra/infra-bootstrap/`
  - 60_apps/ 結構（僅 manifests）
  - pf.sh (30420-30421)
  - Makefile（infra 專用）

---

**建議**: **立即建立獨立 repo `immich-line-bot`**，不要放在 infra-bootstrap。

**最後更新**: 2026-05-27  
**負責人**: Infrastructure Team + App Dev Team
