# Immich LINE Bot - 問題解答

**日期**: 2026-05-27  
**相關文檔**: [REPO_ARCHITECTURE_RECOMMENDATION.md](./REPO_ARCHITECTURE_RECOMMENDATION.md)

---

## 問題 1: Helm Deploy + Port-Forward

> line bot 要 helm deploy to k8s server, 有需要的話，應該要用 infra-bootstrap 的 pf.sh 處理 port-forward, 但是 port range 要跟 grid-bot-v3, fuqi-asset-manager 區隔開

### ✅ 解答

**建議**: 建立獨立 repo `immich-line-bot`，有自己的 Helm chart 和 pf.sh

#### Port Range 分配

```yaml
# 現有分配
fuqi-asset-manager:    30400-30410  (scripts/dev/pf.sh)
infra-bootstrap apps:  30420-30429  (scripts/dev/pf.sh)

# 新增分配
immich-line-bot:       30430-30439  (scripts/dev/pf.sh) ⭐
```

#### 實作方式

```bash
# immich-line-bot/scripts/dev/pf.sh
#!/usr/bin/env bash
set -eo pipefail

PF_LOCAL_LINE_BOT_PORT="${PF_LOCAL_LINE_BOT_PORT:-30430}"

# 參考 fuqi-asset-manager/scripts/dev/pf.sh 結構
register_tunnel() {
  register_tunnel line-bot "Immich LINE Bot" "$PF_LOCAL_LINE_BOT_PORT" 3000 \
    immich-line-bot /health LINE_BOT_URL "http://127.0.0.1:${PF_LOCAL_LINE_BOT_PORT}" 0
}

# 用法:
# ./scripts/dev/pf.sh
# 輸出: Port-forward: immich-line-bot → 127.0.0.1:30430
```

#### Helm Deployment

```yaml
# immich-line-bot/deploy/helm/immich-line-bot/values.yaml
image:
  repository: registry.3q.fi/immich-line-bot
  tag: latest
  
service:
  type: ClusterIP
  port: 3000

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: immich-bot.3q.fi
      paths:
        - path: /
          pathType: Prefix
```

**部署命令**:

```bash
# 在 immich-line-bot repo
make deploy

# 或
helm upgrade --install immich-line-bot ./deploy/helm/immich-line-bot \
  --namespace immich \
  --create-namespace
```

**Port-forward**:

```bash
# 在 immich-line-bot repo
./scripts/dev/pf.sh

# 或（使用 Makefile）
make pf
```

---

## 問題 2: 源碼放置與 Makefile 整合

> 因為會有 src code, 應該放在哪邊比較好？如果需要設計 make lint, make commit, make pull_request, make release 應該跟 infra-bootstrap 本身的 make lint, commit, pull_request, release process 如何整合? (infra repo, apps repo 是否應該拆開?)

### ✅ 解答：建立獨立 Repo

**結論**: **強烈建議**建立獨立 repo `immich-line-bot`（參考 `fuqi-asset-manager` 模式）

#### 為何拆開？

| 考量點 | 獨立 Repo ✅ | Monorepo (infra-bootstrap) ❌ |
|--------|--------------|------------------------------|
| **源碼管理** | 清晰獨立，應用邏輯分離 | 混在 60_apps/，違反基礎設施 repo 定位 |
| **CI/CD** | 獨立 pipeline，應用變更不觸發 infra CI | 耦合，應用 commit 會觸發整個 infra CI |
| **Makefile** | 應用專用（eslint, ts-node, npm） | 衝突（lint-ansible vs lint-eslint） |
| **版本管理** | 獨立版本號（v1.0.0） | 跟隨 infra 版本，不合理 |
| **團隊協作** | App Dev Team vs Infra Ops Team | 混合，權限管理複雜 |
| **PROGRESS_TRACKING** | 獨立應用進度 | 混在基礎設施進度，難以追蹤 |
| **參考先例** | fuqi-asset-manager, grid-bot-v3 ✅ | 無先例 |

#### 現有範例

```bash
# 查看現有應用 repo 結構
ls -d /Users/light0/DEV/*/

# 結果:
/Users/light0/DEV/fuqi-asset-manager/     # 應用 repo ✅
/Users/light0/DEV/grid-bot-v3/            # 應用 repo ✅
/Users/light0/DEV/ibkr-portfolio-miniapp/ # 應用 repo ✅
/Users/light0/DEV/infra/infra-bootstrap/  # 基礎設施 repo
```

**觀察**:
- 所有**有源碼的應用**都是**獨立 repo**
- `infra-bootstrap` 僅管理基礎設施（k8s manifests, Ansible, monitoring）
- `60_apps/` 主要是**無源碼**的應用（如 Immich 使用 upstream Helm chart）

#### Makefile 整合方式

**不需要整合**！每個 repo 有自己的 Makefile。

```makefile
# immich-line-bot/Makefile (獨立)
.PHONY: lint lint-all commit pull_request release deploy

# Cursor lint-fix-agent 整合（與 fuqi-asset-manager 相同）
include scripts/cursor-lint-fix-agent-bridge/share/Makefile.lint.mk

lint: cursor-lint-changed ## 變更檔 lint

lint-all: cursor-lint-all ## 全庫 lint

commit: lint ## Lint + AI commit
	./scripts/git-auto-commit.sh

pull_request: commit ## Lint → commit → PR → merge
	./scripts/create-pull-request.sh

release: build deploy ## Build + Deploy
	# ...

# ───────────────────────────────────────────────
# infra-bootstrap/Makefile (獨立)
.PHONY: lint-ansible lint-tekton deploy-sentinel

lint-ansible: ## Ansible lint
	# ...

deploy-sentinel: ## Deploy k8s-sentinel
	# ...
```

**結論**: 兩個 Makefile **完全獨立**，沒有衝突。

---

## 問題 3: PROGRESS_TRACKING 管理

> @PROGRESS_TRACKING.md 這個 PROGRESS_TRACKING SOT 是 infra-bootstrap repo overall 的? 不應該獨立用來管理 immich enhancement project... 這也回到 2 的討論，repo 應該如何管理，請提出完整建議

### ✅ 解答：分層管理

**完全正確**！PROGRESS_TRACKING 應該分層管理，不要混在一起。

#### 建議架構

```yaml
# ══════════════════════════════════════════════════════════════════════
# Tier 1: infra-bootstrap (基礎設施 repo)
# ══════════════════════════════════════════════════════════════════════
infra-bootstrap/00_docs/planning/PROGRESS_TRACKING.md
  - 範圍: infra-bootstrap 整體進度（基礎設施、k8s、monitoring）
  - 類型: 基礎設施任務（Ansible, Tekton, Sentinel 等）
  - Immich Enhancement: 僅「專案概覽」，指向詳細文檔

# ══════════════════════════════════════════════════════════════════════
# Tier 2: Immich Enhancement Project (專案層級)
# ══════════════════════════════════════════════════════════════════════
infra-bootstrap/00_docs/projects/immich-enhancement/PROGRESS_TRACKING.md
  - 範圍: Immich Enhancement 專案整體（5 個 Phase）
  - 類型: 專案層級任務（規劃、GPU 配置、架構決策）
  - LINE Bot: 僅「Phase 概覽」，指向獨立 repo

# ══════════════════════════════════════════════════════════════════════
# Tier 3: immich-line-bot (應用 repo) ⭐
# ══════════════════════════════════════════════════════════════════════
immich-line-bot/docs/PROGRESS_TRACKING.md
  - 範圍: LINE Bot 應用實作進度
  - 類型: 開發任務（TypeScript, Helm, CI/CD）
  - SSOT: 這是 LINE Bot 實作的單一真相來源
```

#### 實際範例

**Tier 1: infra-bootstrap (概覽)**

```markdown
# infra-bootstrap/00_docs/planning/PROGRESS_TRACKING.md

### 4. Immich Enhancement Project 📸

**狀態**: 執行階段  
**類型**: 應用層專案（有獨立 PROGRESS_TRACKING）

> ⚠️ **注意**: 此為**專案概覽**。詳細進度追蹤在：  
> [Immich Enhancement PROGRESS_TRACKING.md](../projects/immich-enhancement/PROGRESS_TRACKING.md)

**已完成** ✅:
- [x] 架構決策：LINE Bot 建立獨立 repo

**進行中** ⏳:
- [ ] 建立 immich-line-bot repo
- [ ] Phase 2: LINE Bot (P0)

**專案文檔**: 
- [Enhancement Project README](../projects/immich-enhancement/README.md)
- [專案進度追蹤（SSOT）](../projects/immich-enhancement/PROGRESS_TRACKING.md)
```

**Tier 2: Immich Enhancement Project (Phase 概覽)**

```markdown
# infra-bootstrap/00_docs/projects/immich-enhancement/PROGRESS_TRACKING.md

## 🔴 P0：Phase 2 - LINE Bot

**Repo**: 獨立 repo `immich-line-bot`  
**Port Range**: 30430-30439

> 📊 **詳細進度**: 見 `immich-line-bot/docs/PROGRESS_TRACKING.md`

### 2.0 Repo 建立
- [ ] 建立 GitHub repo
- [ ] 初始化 TypeScript
- [ ] 建立 Helm chart

### 2.1 核心功能（概覽）
- [ ] LINE webhook handler
- [ ] Immich API 上傳
- [ ] GPT-4V 標註

**詳見**: immich-line-bot repo PROGRESS_TRACKING
```

**Tier 3: immich-line-bot (實作 SSOT) ⭐**

```markdown
# immich-line-bot/docs/PROGRESS_TRACKING.md

## 🔴 P0：核心功能實作

### 1.1 LINE Webhook Handler
**狀態**: ⏳ 開發中
**負責**: @dev1
**檔案**: src/handlers/line-webhook.ts

- [x] Express server 設定
- [x] LINE SDK 整合
- [ ] Webhook 驗證（signature）
- [ ] 照片接收處理
- [ ] 錯誤處理

### 1.2 Immich API 上傳
**狀態**: ⏳ 開發中
**檔案**: src/handlers/immich-upload.ts

- [ ] Immich API client
- [ ] Multipart form-data 上傳
- [ ] EXIF 保留
- [ ] 重試機制

### 1.3 AI 標註
**狀態**: 📋 待開始
**檔案**: src/handlers/ai-annotation.ts

- [ ] CLIP 標籤整合
- [ ] GPT-4V 描述生成
- [ ] GPS 反向地理編碼
```

#### 總結

| Repo | PROGRESS_TRACKING 範圍 | 類型 |
|------|------------------------|------|
| **infra-bootstrap** | 基礎設施整體 | 高階概覽 |
| **immich-enhancement (project)** | Immich 專案（5 Phase） | Phase 概覽 |
| **immich-line-bot (app)** | LINE Bot 實作 | **實作 SSOT** ⭐ |

**原則**: 
- 每個 repo 有自己的 PROGRESS_TRACKING
- 上層文檔僅保留「概覽」+ 指向下層詳細文檔
- 避免任務重複追蹤（DRY 原則）

---

## 🎯 完整建議總結

### 1. Repo 架構

```
/Users/light0/DEV/
├── infra/
│   └── infra-bootstrap/          # 基礎設施 repo
│       ├── 40_k8s/
│       ├── 50_ansible/
│       ├── 60_apps/
│       │   ├── immich/           # Immich server (無源碼)
│       │   ├── monitoring/
│       │   └── ...
│       ├── 00_docs/
│       │   ├── planning/
│       │   │   └── PROGRESS_TRACKING.md  # Tier 1: infra 整體
│       │   └── projects/
│       │       └── immich-enhancement/
│       │           ├── README.md
│       │           ├── PROGRESS_TRACKING.md  # Tier 2: 專案概覽
│       │           └── REPO_ARCHITECTURE_RECOMMENDATION.md ⭐
│       └── Makefile              # infra 專用
│
├── fuqi-asset-manager/           # 應用 repo（現有）
│   ├── src/
│   ├── deploy/helm/
│   ├── scripts/dev/pf.sh         # 30400-30410
│   ├── Makefile
│   └── docs/PROGRESS_TRACKING.md
│
├── grid-bot-v3/                  # 應用 repo（現有）
│   ├── src/
│   ├── deploy/
│   └── Makefile
│
└── immich-line-bot/              # 應用 repo（新建）⭐
    ├── src/
    │   ├── index.ts
    │   ├── handlers/
    │   ├── config/
    │   └── types/
    ├── deploy/
    │   └── helm/immich-line-bot/
    ├── scripts/
    │   └── dev/pf.sh             # 30430-30439
    ├── .github/workflows/
    ├── Makefile
    ├── package.json
    ├── Dockerfile
    └── docs/
        └── PROGRESS_TRACKING.md  # Tier 3: 實作 SSOT ⭐
```

### 2. Port Range 分配

| Service | Port Range | Repo | pf.sh 位置 |
|---------|-----------|------|-----------|
| fuqi-asset-manager | 30400-30410 | fuqi-asset-manager | scripts/dev/pf.sh |
| infra apps (qwen, registry) | 30420-30429 | infra-bootstrap | scripts/dev/pf.sh |
| **immich-line-bot** | **30430-30439** | **immich-line-bot** | **scripts/dev/pf.sh** ⭐ |
| (預留) | 30440+ | 未來服務 | - |

### 3. Makefile 策略

**不需要整合**！每個 repo 獨立：

```makefile
# infra-bootstrap/Makefile
- make lint-ansible
- make deploy-sentinel
- make cluster-check

# immich-line-bot/Makefile
- make lint           # TypeScript/ESLint
- make commit         # Cursor SDK + git-auto-commit
- make pull_request
- make release        # Docker build + Helm deploy
- make pf             # Port-forward (30430)
```

### 4. PROGRESS_TRACKING 分層

```
Tier 1: infra-bootstrap/00_docs/planning/PROGRESS_TRACKING.md
  └─ 專案概覽 → Tier 2

Tier 2: infra-bootstrap/00_docs/projects/immich-enhancement/PROGRESS_TRACKING.md
  └─ Phase 概覽 → Tier 3

Tier 3: immich-line-bot/docs/PROGRESS_TRACKING.md  ⭐ SSOT
  └─ 實作任務（最詳細）
```

### 5. 下一步行動

**立即執行**（今天）:

```bash
# 1. 建立 GitHub repo
cd /Users/light0/DEV
gh repo create immich-line-bot --public --description "LINE Bot for Immich photo auto-upload"
git clone https://github.com/YOUR_ORG/immich-line-bot.git

# 2. 初始化專案
cd immich-line-bot
npm init -y
mkdir -p src/{handlers,config,utils,types}
mkdir -p deploy/helm/immich-line-bot/templates
mkdir -p scripts/dev
mkdir -p docs

# 3. 複製範本（從 fuqi-asset-manager）
cp /Users/light0/DEV/fuqi-asset-manager/Makefile .
cp /Users/light0/DEV/fuqi-asset-manager/scripts/dev/pf.sh scripts/dev/
# 調整 port 為 30430

# 4. 建立基礎檔案
touch src/index.ts
touch Dockerfile
touch .env.example
touch README.md
touch docs/PROGRESS_TRACKING.md

# 5. Git commit
git add .
git commit -m "Initial project structure"
git push
```

---

## 📚 參考文檔

- **完整架構建議**: [REPO_ARCHITECTURE_RECOMMENDATION.md](./REPO_ARCHITECTURE_RECOMMENDATION.md) ⭐
- **LINE Bot 實作**: [PHASE2_LINE_BOT.md](./PHASE2_LINE_BOT.md)
- **專案進度**: [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md)
- **專案總覽**: [README.md](./README.md)

**參考範例**:
- fuqi-asset-manager: `/Users/light0/DEV/fuqi-asset-manager/`
- grid-bot-v3: `/Users/light0/DEV/grid-bot-v3/`

---

**最後更新**: 2026-05-27  
**負責人**: Infrastructure Team + App Dev Team  
**決策**: ✅ 建立獨立 repo `immich-line-bot`
