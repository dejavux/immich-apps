# Immich Apps - Repo 建立完成總結

**日期**: 2026-05-27  
**決策**: 建立獨立 repo `immich-apps`，整合所有 Immich 組件  
**Repo**: <https://github.com/dejavux/immich-apps>

---

## ✅ 已完成工作

### 1. 建立新 Repo

- ✅ **GitHub Repo**: <https://github.com/dejavux/immich-apps>
- ✅ **目錄結構**: 完整的 deploy/, src/, scripts/, docs/ 結構
- ✅ **基礎配置**: Makefile, package.json, tsconfig.json, Dockerfile
- ✅ **初始 Commit**: 已 push 到 GitHub

### 2. 遷移內容

**從 infra-bootstrap 複製**:

- ✅ **Manifests**: `deploy/manifests/` (7 個 YAML 文件)
  - immich-deployment.yaml
  - immich-local-pv.yaml
  - immich-loadbalancer.yaml
  - immich-ingress.yaml
  - immich-configmap.yaml
  - metallb-immich-pool.yaml
  - 1password-items.yaml

- ✅ **Scripts**: `scripts/`
  - deploy-immich.sh
  - deploy.yml (Ansible)

- ✅ **文檔**: `docs/` (12 個文檔)
  - PROGRESS_TRACKING.md (SSOT)
  - README.md (專案總覽)
  - PHASE2_LINE_BOT.md
  - PHASE3_PHOTO_SYNC.md
  - GPU_CONFIGURATION.md
  - QUESTIONS_ANSWERED.md
  - REPO_ARCHITECTURE_RECOMMENDATION.md
  - REPO_CONSOLIDATION_PLAN.md
  - ... 等

### 3. 更新 infra-bootstrap 引用

- ✅ **60_apps/immich/README.md**: 簡化為 directive，指向新 repo
- ✅ **00_docs/projects/immich-enhancement/README.md**: 標記為已遷移（歷史參考）
- ✅ **00_docs/living-systems/applications/immich/README.md**: 更新連結指向新 repo
- ✅ **00_docs/planning/PROGRESS_TRACKING.md**: （已更新，指向新 repo）

---

## 📁 新 Repo 結構

```
immich-apps/ (https://github.com/dejavux/immich-apps)
├── deploy/
│   ├── helm/                          # Helm charts（待建立）
│   │   ├── immich-server/
│   │   ├── immich-line-bot/
│   │   └── immich-photo-sync/
│   └── manifests/                     # kubectl manifests ✅
│       ├── immich-deployment.yaml
│       ├── immich-local-pv.yaml
│       └── ... (7 個 YAML)
├── src/
│   ├── line-bot/                      # LINE Bot TypeScript（待開發）
│   ├── photo-sync/                    # Photo Sync 腳本（待開發）
│   └── shared/                        # 共用程式碼
├── scripts/
│   ├── dev/                           # Port-forward 腳本（待建立）
│   ├── deploy-immich.sh               ✅
│   └── deploy.yml                     ✅
├── docs/                              # 完整文檔 ✅
│   ├── PROGRESS_TRACKING.md           # SSOT
│   ├── README.md
│   ├── PHASE2_LINE_BOT.md
│   ├── PHASE3_PHOTO_SYNC.md
│   ├── GPU_CONFIGURATION.md
│   ├── QUESTIONS_ANSWERED.md
│   ├── REPO_ARCHITECTURE_RECOMMENDATION.md
│   ├── REPO_CONSOLIDATION_PLAN.md
│   └── ...
├── .github/workflows/                 # CI/CD（待建立）
├── Makefile                           ✅
├── package.json                       ✅
├── tsconfig.json                      ✅
├── Dockerfile.line-bot                ✅
├── .env.example                       ✅
├── .gitignore                         ✅
└── README.md                          ✅
```

---

## 🎯 下一步行動

### Phase 1: 完善基礎設施（今天～明天）

1. **加入 Cursor Workspace**

   ```bash
   # 在 Cursor: File → Add Folder to Workspace...
   # 選擇: /Users/light0/DEV/immich-apps
   ```

2. **npm install**

   ```bash
   cd /Users/light0/DEV/immich-apps
   npm install
   ```

3. **建立 pf.sh**

   ```bash
   # 複製並調整 fuqi-asset-manager/scripts/dev/pf.sh
   # Port: 30430
   ```

4. **建立 Helm Charts**
   - immich-server（wrapper for upstream chart）
   - immich-line-bot

### Phase 2: LINE Bot 開發（本週）

1. **實作 TypeScript 源碼**
   - src/line-bot/index.ts
   - src/line-bot/handlers/
   - 參考：docs/PHASE2_LINE_BOT.md

2. **1Password 憑證設定**
   - Immich-LINE-Bot
   - Immich-API-Key
   - OpenAI-API-Key

3. **本機測試**

   ```bash
   make dev-line-bot
   make pf
   ```

4. **部署到 k8s**

   ```bash
   make deploy-line-bot
   ```

### Phase 3: Photo Sync（下週）

參考：docs/PHASE3_PHOTO_SYNC.md

---

## 📊 Workspace 狀態

**當前 Workspace** (建議配置):

1. **infra-bootstrap** - 基礎設施
2. **fuqi-asset-manager** - 資產管理應用
3. **ibkr-portfolio-miniapp** - 投資組合應用
4. **immich-apps** - 照片管理應用 ⭐ (新增)

**數量**: 4 個 repo  
**評估**: ✅ 合理，功能清晰分離

---

## 🔗 重要連結

### Immich Apps（新 Repo）

- **Repo**: <https://github.com/dejavux/immich-apps>
- **本機路徑**: /Users/light0/DEV/immich-apps
- **文檔**: <https://github.com/dejavux/immich-apps/tree/main/docs>
- **進度追蹤**: <https://github.com/dejavux/immich-apps/blob/main/docs/PROGRESS_TRACKING.md>

### infra-bootstrap（指向性）

- **60_apps/immich/**: 指向新 repo
- **00_docs/projects/immich-enhancement/**: 已遷移標記（歷史參考）
- **00_docs/living-systems/applications/immich/**: 系統概覽（已更新連結）

---

## 💡 使用方式

### 部署

```bash
# 進入新 repo
cd /Users/light0/DEV/immich-apps

# 部署所有組件
make deploy-all

# 或分別部署
make deploy-server
make deploy-line-bot
```

### 開發

```bash
# Port-forward
make pf

# 開發 LINE Bot
make dev-line-bot

# 查看 logs
make logs

# 檢查狀態
make status
```

### Git 工作流

```bash
# Lint + Commit
make commit

# PR → merge
make pull_request
```

---

## 📝 Commit 建議

**infra-bootstrap** (待 commit):

```bash
cd /Users/light0/DEV/infra/infra-bootstrap

git add .
git commit -m "docs: migrate Immich to independent repo immich-apps

- Update 60_apps/immich/README.md to directive
- Mark 00_docs/projects/immich-enhancement/ as migrated (historical reference)
- Update 00_docs/living-systems/applications/immich/ links to new repo
- Update PROGRESS_TRACKING.md to reference immich-apps repo

All Immich components (server + LINE Bot + photo sync) now consolidated in:
https://github.com/dejavux/immich-apps"
```

---

## ✅ 決策總結

### 為何整合成單一 Repo？

1. **統一管理**: Immich server + LINE Bot + Photo Sync 緊密耦合
2. **版本控制**: 統一版本號，避免跨 repo 協調
3. **CI/CD 簡化**: 一次部署所有組件
4. **文檔集中**: 單一 PROGRESS_TRACKING.md
5. **參考成功模式**: fuqi-asset-manager 的多微服務架構

### Port Range

- fuqi-asset-manager: 30400-30410
- infra-bootstrap: 30420-30429
- **immich-apps: 30430-30439** ⭐

### Workspace 管理

- ✅ 4 個 repo 合理（不過多）
- ✅ 功能清晰分離
- ✅ 便於跨 repo 參考和搜尋

---

**完成日期**: 2026-05-27  
**狀態**: ✅ Repo 建立完成，基礎配置就緒  
**下一步**: 加入 Workspace + 開發 LINE Bot  
**負責人**: Infrastructure Team + App Dev Team
