# Immich Apps

**完整的 Immich 生態系統**：Immich server + LINE Bot + Photo Sync

> 🚀 **Status**: Phase 2 ✅ · Phase 3 ✅ · Phase 3.5 Phase B 收尾中 🟡 · Phase 3.6 M3 ✅ M3.1 待 PR · Immich **v2.7.5** ✅  
> 📊 **Progress**: [PROGRESS_TRACKING.md](./docs/00_planning/PROGRESS_TRACKING.md)  
> 📋 **如何進行**: [HOW_TO_PROCEED.md](./docs/00_planning/HOW_TO_PROCEED.md)  
> 🏗️ **K8s 部署**: [K8S_DEPLOYMENT.md](./docs/20_guides/infra/K8S_DEPLOYMENT.md)

---

## 🎯 專案簡介

統一管理所有 Immich 相關組件：

1. **Immich Server**: 核心照片管理系統（upstream Helm chart + 自定義配置）
2. **LINE Bot**: 從 LINE 自動上傳照片到 Immich + AI 標註
3. **Photo Sync**: Mac Photos Library 自動同步

---

## 📁 目錄結構

```
immich-apps/
├── deploy/
│   ├── helm/                      # Helm charts
│   │   ├── immich-server/         # Immich server
│   │   ├── immich-line-bot/       # LINE Bot
│   │   └── immich-photo-sync/     # Photo Sync
│   └── manifests/                 # kubectl manifests (備用)
├── src/
│   ├── line-bot/                  # LINE Bot TypeScript 源碼
│   ├── photo-sync/                # Photo Sync scripts
│   └── shared/                    # 共用程式碼
├── scripts/
│   ├── dev/pf.sh                  # Port-forward (30450-30479)
│   └── deploy-all.sh              # 部署所有組件
├── docs/                          # 文檔（00_planning / 20_guides / 60_completed）
│   ├── 00_planning/               # SSOT + 進行中專案
│   ├── 20_guides/                 # 操作手冊
│   └── 60_completed/              # 已結案歸檔
├── Makefile
├── package.json
└── README.md
```

---

## 🚀 快速開始

### 前置條件

- Kubernetes 叢集運行中
- MetalLB 已部署
- 1Password Operator 已配置
- GPU 節點已標籤（worker3）

### 部署所有組件

```bash
# 1. Clone repo
git clone https://github.com/dejavux/immich-apps.git
cd immich-apps

# 2. 部署
make deploy-all

# 或分別部署
make deploy-server    # Immich server
make deploy-line-bot  # LINE Bot
make deploy-sync      # Photo Sync
```

### 本機開發

```bash
# Port-forward
make pf

# 開發 LINE Bot
make dev-line-bot

# 查看 logs
make logs
```

---

## 📊 組件概覽

### 1. Immich Server

- **Namespace**: `immich`
- **Components**: server, machine-learning, redis, postgres
- **Web UI**: <https://immich.3q.fi>
- **Storage**: lama hostPath (HDD) → Phase 4 SSD 遷移（defer P2）

### 2. LINE Bot

- **Namespace**: `immich`
- **Port**: 30450 (port-forward)
- **Webhook**: <https://immich-bot.3q.fi/webhook/line>
- **Features**:
  - 從 LINE 接收照片
  - 自動上傳到 Immich
  - AI 標註（CLIP + Smart Search；V1.1 Qwen vision defer P3）

### 3. Photo Sync

- **Type**: Mac 本機 LaunchDaemon
- **Source**: Mac Photos Library
- **Target**: Immich server
- **Method**: Immich CLI + fswatch

---

## 🛠️ 開發指南

### Makefile 命令

```bash
# 開發
make lint              # 變更檔 lint
make commit            # Lint + AI commit
make pull_request      # PR → merge

# 部署
make deploy-all        # 部署所有組件
make deploy-server     # 部署 Immich server
make deploy-line-bot   # 部署 LINE Bot

# Build & Release
make build-line-bot    # Docker build LINE Bot（本機）
make deploy-line-bot   # Helm deploy
make helm-lint         # Helm chart lint
make release           # Tekton BuildKit + deploy（TODO）
make release-line-bot  # Build + Deploy（本機暫用）

# 本機
make pf                # Port-forward (30450)
make dev-line-bot      # 本機開發 LINE Bot
make logs              # 查看 k8s logs
```

### Port Range

| Service | Port | 用途 |
|---------|------|------|
| LINE Bot | 30450 | Webhook server |
| (預留) | 30431-30439 | 未來服務 |

---

## 📚 文檔

→ **[docs/README.md](./docs/README.md)** — 完整導覽

| 用途 | 連結 |
|------|------|
| 任務 SSOT | [PROGRESS_TRACKING.md](./docs/00_planning/PROGRESS_TRACKING.md) |
| 執行指南 | [HOW_TO_PROCEED.md](./docs/00_planning/HOW_TO_PROCEED.md) |
| 指令參考 | [COMMAND_REFERENCE.md](./docs/20_guides/COMMAND_REFERENCE.md) |
| LINE Bot V1.1 | [10_REQUIREMENTS.md](./docs/00_planning/line-bot/10_REQUIREMENTS.md) |
| Photo Sync（結案） | [phase3-photo-sync-bulk/](./docs/60_completed/phase3-photo-sync-bulk/) |
| K8s / Tekton | [K8S_DEPLOYMENT.md](./docs/20_guides/infra/K8S_DEPLOYMENT.md) |
| 已結案 | [60_completed/](./docs/60_completed/) |

---

## 🏗️ 架構

### System Overview

```mermaid
graph TB
    subgraph "Immich Apps"
        Server[Immich Server]
        ML[Machine Learning<br/>GPU: worker3]
        Redis[Redis]
        PG[(PostgreSQL)]
        LineBot[LINE Bot]
        PhotoSync[Photo Sync<br/>Mac]
    end
    
    subgraph "外部"
        User[用戶]
        LINE[LINE App]
        MacPhotos[Mac Photos<br/>Library]
    end
    
    User -->|Web UI| Server
    User -->|轉發照片| LINE
    LINE -->|Webhook| LineBot
    LineBot -->|上傳| Server
    MacPhotos -->|fswatch + CLI| PhotoSync
    PhotoSync -->|上傳| Server
    Server --> ML
    Server --> Redis
    Server --> PG
```

### Deployment

- **Namespace**: `immich`
- **Ingress**: Caddy reverse proxy
- **Storage**: lama hostPath (規劃遷移到 SSD)
- **Secrets**: 1Password Operator

---

## 📊 監控

### Grafana Dashboard

- **Immich**: <https://grafana.3q.fi/d/immich>
- **Metrics**: `/metrics` 端點（LINE Bot, server）

### Health Checks

```bash
# Immich server
curl https://immich.3q.fi/api/server-info/ping

# LINE Bot
curl https://immich-bot.3q.fi/health
```

---

## 🔧 疑難排解

### 常見問題

詳見：[60_completed/phase2-line-bot-mvp/10_REQUIREMENTS.md - Troubleshooting](./docs/60_completed/phase2-line-bot-mvp/10_REQUIREMENTS.md#troubleshooting)

### 快速診斷

```bash
# 檢查 Pods 狀態
kubectl get pods -n immich

# 查看 logs
make logs

# Port-forward 測試
make pf
curl http://127.0.0.1:30450/health
```

---

## 🤝 貢獻

1. Fork repo
2. 建立 feature branch
3. Make changes
4. `make commit` (自動 lint + AI commit)
5. `make pull_request`

---

## 📝 License

MIT

---

## 🔗 相關連結

- **Immich Official**: <https://immich.app/>
- **LINE Messaging API**: <https://developers.line.biz/>
- **OpenAI Vision API**: <https://platform.openai.com/docs/guides/vision>

---

**最後更新**: 2026-06-17  
**維護者**: Infrastructure Team + App Dev Team  
**Repo**: <https://github.com/dejavux/immich-apps>
