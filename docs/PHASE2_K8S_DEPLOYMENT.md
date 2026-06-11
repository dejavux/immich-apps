# Phase 2: K8s 部署 — Tekton + BuildKit + Helm + HTTPS

**狀態**: 📋 規劃中（待實作）  
**優先級**: P0（LINE Bot 上線必經）  
**Repo**: `immich-apps`  
**最後更新**: 2026-06-10

---

## 🎯 目標

將 LINE Bot MVP 部署到 Kubernetes，並符合現有 infra 慣例：

| 需求 | 方案 |
|------|------|
| **映像建置** | Tekton Pipeline + **BuildKit**（`buildkitd.buildkit.svc`） |
| **部署** | **Helm chart** `deploy/helm/immich-line-bot/` |
| **LINE Webhook URL** | **HTTPS** `https://immich-bot.3q.fi/webhook/line` |
| **憑證** | 1Password Operator → K8s Secret（`Infra-Apps` vault） |
| **Registry** | `registry-internal.3q.fi/immich-line-bot:<tag>` |
| **Namespace** | `immich`（與 immich-server 同 namespace） |

**不採用 ngrok 作為正式方案**（僅本機 dev）；生產一律 K8s + 公網 HTTPS。

---

## 🏗️ 架構總覽

```text
┌─────────────────────────────────────────────────────────────────┐
│  Release（本機 / CI）                                            │
│  make release  →  Tekton PipelineRun (ci-tenant-immich-apps)    │
│                   → BuildKit build + push registry-internal       │
│                   → helm upgrade immich-line-bot                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Runtime（namespace: immich）                                    │
│  Internet → Route53 → Caddy → ingress-nginx → Ingress           │
│           → Service immich-line-bot:3000                        │
│           → Pod (LINE webhook + Immich upload)                  │
│           → immich-server:2283 (cluster internal)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LINE Platform                                                   │
│  Webhook: https://immich-bot.3q.fi/webhook/line                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 目錄結構（目標）

```text
immich-apps/
├── Dockerfile.line-bot              # BuildKit 建置入口
├── ci/tekton/
│   ├── README.md
│   └── release/
│       ├── pipeline-immich-release.yaml
│       ├── task-buildkit-build.yaml   # 可 reuse fuqi 模式
│       └── kustomization.yaml
├── deploy/helm/immich-line-bot/
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── values-prod.yaml
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── ingress.yaml
│       ├── onepassworditems.yaml
│       └── _helpers.tpl
└── scripts/
    ├── release.sh                   # Tekton release 入口
    └── deploy-line-bot.sh           # helm upgrade 包裝
```

**infra-bootstrap 側（另 PR）**：

```text
infra-bootstrap/
├── 60_apps/tekton-ci/
│   ├── kustomize/base/rbac-runner-tenant-immich-apps.yaml   # 新增
│   └── scripts/bootstrap-immich-apps-tenant-secrets.sh      # 新增
├── 60_apps/caddy/Caddyfile                                    # + immich-bot.3q.fi
└── 60_apps/cert-manager/manifests/immich-bot-ingress.yaml   # 或 Helm 內 Ingress
```

---

## 1. Tekton + BuildKit Release

### 1.1 參考先例

| 專案 | Tenant NS | 說明 |
|------|-----------|------|
| fuqi-asset-manager | `ci-tenant-fuqi-asset-manager` | `make release` → BuildKit pipeline |
| grid-bot-v3 | `ci-tenant-grid-bot-v3` | 同上 |
| ibkr-portfolio-miniapp | `ci-tenant-ibkr-portfolio-miniapp` | 較小 app 範本 |
| **immich-apps** | **`ci-tenant-immich-apps`** | **新建** |

BuildKit 用法見 infra-bootstrap：[`60_apps/buildkit/docs/USAGE-CI.md`](https://github.com/dejavux/infra-bootstrap/blob/main/60_apps/buildkit/docs/USAGE-CI.md)

### 1.2 Release Pipeline（規格）

**Pipeline 名稱**: `immich-release`  
**Namespace**: `ci-tenant-immich-apps`

| Step | Task | 說明 |
|------|------|------|
| 1 | `git-clone` | clone `dejavux/immich-apps` @ revision |
| 2 | `immich-buildkit-build` | `Dockerfile.line-bot` → registry |
| 3 | `helm-deploy`（可選） | `helm upgrade immich-line-bot` |

**Params**:

| Param | 預設 | 說明 |
|-------|------|------|
| `repo-url` | `https://github.com/dejavux/immich-apps.git` | |
| `revision` | `main` / git SHA | |
| `image-tag` | git SHA 或 `v0.1.0` | |
| `registry` | `registry.docker-registry-internal.svc.cluster.local:5000` | internal HTTP |
| `push-mirror` | `registry-internal.3q.fi/immich-line-bot` | 對外 pull |

**Workspaces**:

- `source` — git checkout（建議 `nfs-client` RWX，與 fuqi 相同）
- `git-credentials` — `github-pat`
- `dockerconfig` — `registry-push`（自 `buildkit` namespace 同步）

### 1.3 Makefile 目標

```makefile
release:          ## Tekton BuildKit build + helm deploy
release-build:    ## 僅 build 映像（IMMICH_RELEASE_SKIP_DEPLOY=1）
deploy-line-bot:  ## 僅 helm upgrade（映像已存在）
```

範例：

```bash
# 建置 + 部署
make release IMAGE_TAG=$(git rev-parse --short HEAD)

# 僅建置
IMMICH_RELEASE_SKIP_DEPLOY=1 make release IMAGE_TAG=v0.1.0
```

### 1.4 infra-bootstrap Bootstrap（一次性）

```bash
# infra-bootstrap repo
bash 60_apps/tekton-ci/scripts/bootstrap-immich-apps-tenant-secrets.sh
kubectl apply -k immich-apps/ci/tekton/release/   # 或從 immich-apps repo apply
```

需建立：

- [ ] `ci-tenant-immich-apps` namespace
- [ ] RBAC `ServiceAccount` / RoleBinding（runner）
- [ ] Secret `github-pat`、`registry-push` 同步

---

## 2. Helm Chart 部署

### 2.1 Chart: `immich-line-bot`

**路徑**: `deploy/helm/immich-line-bot/`（骨架已建立）

```bash
helm upgrade --install immich-line-bot ./deploy/helm/immich-line-bot \
  --namespace immich \
  --create-namespace \
  -f deploy/helm/immich-line-bot/values.yaml \
  -f deploy/helm/immich-line-bot/values-prod.yaml \
  --set image.tag=v0.1.0
```

### 2.2 主要 values

| Key | 生產值 | 說明 |
|-----|--------|------|
| `image.repository` | `registry-internal.3q.fi/immich-line-bot` | |
| `image.tag` | Tekton 產物 tag | |
| `service.port` | `3000` | |
| `ingress.enabled` | `true` | |
| `ingress.host` | `immich-bot.3q.fi` | |
| `ingress.path` | `/webhook/line` | LINE webhook |
| `env.immichBaseUrl` | `http://immich-server:2283` | 叢集內 API |
| `env.immichWebUrl` | `https://immich.3q.fi` | 回覆用連結 |
| `onepassword.lineBotItemPath` | `vaults/Infra-Apps/items/Immich-LINE-Bot` | |
| `onepassword.immichApiItemPath` | `vaults/Infra-Apps/items/Immich-API-Key` | |

### 2.3 1Password Operator

Helm 建立兩個 `OnePasswordItem`：

- `immich-line-bot-credentials` ← `Immich-LINE-Bot`
- `immich-api-credentials` ← `Immich-API-Key`

Deployment 掛載：

```yaml
env:
  - name: LINE_CHANNEL_SECRET
    valueFrom:
      secretKeyRef:
        name: immich-line-bot-credentials
        key: channel-secret
  - name: LINE_CHANNEL_ACCESS_TOKEN
    valueFrom:
      secretKeyRef:
        name: immich-line-bot-credentials
        key: access-token
  - name: IMMICH_API_KEY
    valueFrom:
      secretKeyRef:
        name: immich-api-credentials
        key: api-key
```

> Operator 欄位名 → Secret key 規則：小寫、空白轉 `-`（與 fuqi-asset-manager 相同）。

---

## 3. HTTPS — `immich-bot.3q.fi`

### 3.1 拓撲（與 lazybot / telegram-bff 相同）

```text
Internet → Route53 A (WAN IP) → NAT:443 → Caddy
  → ingress-nginx NodePort → Ingress (Host: immich-bot.3q.fi)
  → Service immich-line-bot → Pod :3000
```

參考 runbook：

- infra-bootstrap [`domain-management.md`](https://github.com/dejavux/infra-bootstrap/blob/main/00_docs/operations/runbooks/domain-management.md)
- [`lazybot-3q-fi-ingress.md`](https://github.com/dejavux/infra-bootstrap/blob/main/60_apps/cert-manager/docs/lazybot-3q-fi-ingress.md)

### 3.2 作業順序

1. **Helm Ingress** 套用（host: `immich-bot.3q.fi`，TLS secret 名）
2. **Caddyfile** 新增 site block：

   ```caddyfile
   immich-bot.3q.fi {
       import ingress_nginx_http
   }
   ```

3. **Route53** A 記錄：`immich-bot.3q.fi` → WAN IP（與 `strapi.3q.fi` 相同）
4. **cert-manager** 確認 Certificate Issued
5. **LINE Console** Webhook URL + Verify

### 3.3 LINE Webhook 設定

| 項目 | 值 |
|------|-----|
| Webhook URL | `https://immich-bot.3q.fi/webhook/line` |
| Use webhook | On |
| Official Account Manager → Webhook | On |
| Auto-reply | **Off** |

驗證：

```bash
curl -sS https://immich-bot.3q.fi/health
# {"status":"ok","service":"immich-line-bot"}
```

---

## 4. 本機 Port-Forward（開發用）

**Port range**: `30450`（見 [PORT_RANGE_PLAN.md](./PORT_RANGE_PLAN.md)）

```bash
./scripts/dev/pf.sh   # 30450 → immich-line-bot:3000
```

與 fuqi（30400–30419）、infra（30420–30439）不衝突。

---

## 5. 實作里程碑

| # | 任務 | 負責 | 狀態 | 預估 |
|---|------|------|------|------|
| M1 | Helm chart 完整化 + `helm template` lint | immich-apps | ✅ 骨架 | 0.5d |
| M2 | Tekton release pipeline + Task | immich-apps + infra-bootstrap | ✅ | 1d |
| M3 | `ci-tenant-immich-apps` bootstrap | infra-bootstrap | ✅ | 0.5d |
| M4 | Caddy + Route53 + Ingress TLS | infra-bootstrap | ✅ 2026-06-11 | 0.5d |
| M5 | `make release` 首次成功 push | immich-apps | ✅ tag=git SHA | 0.5d |
| M6 | LINE Webhook Verify + E2E 傳照片 | Ops | ✅ 2026-06-11 | 0.5d |
| M7 | file 訊息 + P0 中繼資料 | immich-apps | ✅ PR #6 | 0.5d |

**Phase 2 核心完成**: 2026-06-11

---

## 6. 驗收標準

- [x] `make release` 透過 Tekton + BuildKit 建置並 push 映像（tag = git short SHA）
- [x] `helm upgrade immich-line-bot` Pod Running，probes pass
- [x] `https://immich-bot.3q.fi/health` 回 200
- [x] LINE Developers Console Webhook **Verify Success**
- [x] 手機傳照片 → Bot 回覆 → Immich Web UI 可見
- [x] Secrets 來自 1Password Operator（Infra-Platform vault）

### 6.1 原檔 / EXIF 期望（2026-06-11 實測）

LINE「照片」通道**不是**原檔 archive；Immich 內常無相機 EXIF。原檔路徑見 Phase 3 Photo Sync 或 Immich iOS App。

---

## 7. 風險與決策

| 議題 | 決策 |
|------|------|
| Kaniko vs BuildKit | **BuildKit**（與 fuqi/grid-bot 一致；Kaniko 僅 legacy fallback） |
| ngrok | 僅 dev；**生產不用** |
| Immich API URL | Pod 內用 `http://immich-server:2283`；對外連結用 `https://immich.3q.fi` |
| GPT-4V | MVP 不部署 OpenAI secret；V1.1 再加 |
| PR CI | Phase 2.5 後加 L0 lint pipeline（可复用 ibkr 小 pipeline） |

---

## 🔗 相關文檔

- [PHASE2_LINE_BOT.md](./PHASE2_LINE_BOT.md) — Bot 功能規格
- [HOW_TO_PROCEED.md](./HOW_TO_PROCEED.md) — 執行指南
- [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md) — SSOT
- [PORT_RANGE_PLAN.md](./PORT_RANGE_PLAN.md) — pf.sh 30450

**外部**:

- fuqi Tekton release: `fuqi-asset-manager/ci/tekton/release/`
- infra BuildKit: `infra-bootstrap/60_apps/buildkit/`
- infra Tekton CI: `infra-bootstrap/60_apps/tekton-ci/`

---

**維護**: Infrastructure Team + App Dev Team
