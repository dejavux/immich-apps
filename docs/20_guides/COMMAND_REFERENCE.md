# Immich Apps 指令參考

**SSOT 進度**: [00_planning/HOW_TO_PROCEED.md](../00_planning/HOW_TO_PROCEED.md)

---

## 1. 品質 / Git

```bash
make lint              # 變更檔 + Cursor lint-fix-agent
make lint-mechanical   # 離線 / CI（無 SDK）
make lint-all          # 全庫
make commit            # lint + Cursor SDK commit
make pull_request      # lint → commit → PR → merge main
PR_SKIP_MERGE=1 make pull_request
```

詳見 [CURSOR_LINT_FIX_AGENT.md](./CURSOR_LINT_FIX_AGENT.md)

---

## 2. Release（Tekton + Helm）

```bash
make ci-setup            # 首次：Tekton 平台
make ci-setup-secrets    # ci-tenant-immich-apps secrets
make ci-apply-ci         # release + PR pipeline
make release             # Tekton build + helm deploy（tag = git SHA）
make release-build       # 僅 build
make ci-status           # PipelineRun 狀態
make ci-logs             # 最新 release logs
```

映像：`registry-internal.3q.fi/immich-line-bot:<sha>`

---

## 3. 部署

```bash
make deploy-line-bot     # Helm upgrade immich-line-bot
make deploy-server       # Immich server（manifest / helm）
make helm-lint           # Chart lint
```

---

## 4. 本機開發

```bash
make pf                  # port-forward 30450
make dev-line-bot        # npm run dev
npm test                 # unit tests
npm run openapi:sync     # 同步 Immich OpenAPI types
```

---

## 5. Photo Sync（Mac 本機）

```bash
# 設定
cp scripts/photo-sync/photo-sync.config.yaml.example ~/.config/immich-apps/photo-sync.config.yaml

# 全量 / dry-run
./scripts/photo-sync/immich-sync.sh --library icloud-primary
./scripts/photo-sync/immich-sync.sh --library icloud-primary --dry-run

# LaunchAgent（fswatch 增量）
./scripts/photo-sync/install-launchagent.sh
launchctl list | grep immich-photo-sync
tail -f ~/Library/Logs/immich-photo-sync/sync.log
```

規格：[60_completed/phase3-photo-sync-bulk/10_REQUIREMENTS.md](../60_completed/phase3-photo-sync-bulk/10_REQUIREMENTS.md)

---

## 6. Immich server（infra-bootstrap）

```bash
kubectl get pods -n immich
curl -fsS -H "x-api-key: $IMMICH_API_KEY" https://immich.3q.fi/api/server/version
```

升級 checklist：[infra/upgrades/IMMICH_v2.7.5.md](./infra/upgrades/IMMICH_v2.7.5.md)
