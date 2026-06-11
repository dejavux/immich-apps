# Immich Apps - Makefile
# 統一管理 Immich server + LINE Bot + Photo Sync

.PHONY: help build test deploy clean logs status \
	deploy-all deploy-server deploy-line-bot deploy-sync \
	build-line-bot release-line-bot helm-lint \
	ci-setup ci-setup-secrets ci-apply ci-apply-release ci-status ci-logs ci-release \
	lint lint-all lint-mechanical lint-changed-files lint-eslint lint-fix \
	cursor-lint cursor-lint-changed cursor-lint-all \
	git-commit auto-commit auto-commit-brief commit pull_request \
	release release-build pf dev-line-bot

.DEFAULT_GOAL := help

# ── 配置 ──────────────────────────────────────────────────────────────────────

NAMESPACE ?= immich
# 本機 build/deploy 可覆寫；release 一律用 RELEASE_TAG（git short SHA）
IMAGE_TAG ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)
RELEASE_TAG := $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)
REGISTRY ?= registry-internal.3q.fi
TEKTON_TENANT_NS ?= ci-tenant-immich-apps
export PR_BASE_BRANCH ?= main

RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

# ── Cursor lint-fix-agent ─────────────────────────────────────────────────────
# 見 docs/CURSOR_LINT_FIX_AGENT.md

CURSOR_LINT_FIX_AGENT_DIR ?= $(HOME)/workspace/cursor-lint-fix-agent
LINT_TARGET_PREFIX := cursor-
LINT_CHANGED_CMD = bash ./scripts/lint-changed-files.sh --fix
LINT_ALL_CMD = bash ./scripts/lint-all.sh

ifneq ($(wildcard $(CURSOR_LINT_FIX_AGENT_DIR)/share/Makefile.lint.mk),)
include $(CURSOR_LINT_FIX_AGENT_DIR)/share/Makefile.lint.mk
else
.PHONY: cursor-lint cursor-lint-changed cursor-lint-all cursor-lint-changed-run cursor-lint-all-run
cursor-lint cursor-lint-changed cursor-lint-all cursor-lint-changed-run cursor-lint-all-run:
	$(error cursor-lint-fix-agent not found at $(CURSOR_LINT_FIX_AGENT_DIR). \
	Clone: gh repo clone dejavux/cursor-lint-fix-agent $(CURSOR_LINT_FIX_AGENT_DIR) && cd $(CURSOR_LINT_FIX_AGENT_DIR) && npm install. \
	Offline: make lint-mechanical)
endif

ifneq ($(wildcard $(CURSOR_LINT_FIX_AGENT_DIR)/share/Makefile.commit.mk),)
include $(CURSOR_LINT_FIX_AGENT_DIR)/share/Makefile.commit.mk
else
commit auto-commit pull_request:
	$(error cursor-lint-fix-agent not found — 無法使用 make commit / pull_request)
endif

help: ## 顯示幫助信息
	@echo "$(BLUE)Immich Apps - 可用命令:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Lint & Git:$(NC)"
	@echo "  make lint              # 變更檔 + Cursor lint-fix-agent（含 cspell / markdownlint / make）"
	@echo "  make lint-mechanical   # 變更檔僅腳本（無 SDK；CI / 離線）"
	@echo "  make lint-all          # 全庫 + agent"
	@echo "  make commit            # lint + Cursor SDK commit"
	@echo "  make pull_request      # lint → commit → PR → merge $(PR_BASE_BRANCH)"
	@echo "  PR_SKIP_MERGE=1 make pull_request"
	@echo "  AUTO_COMMIT_LINT_TARGET=lint-mechanical make commit"
	@echo ""
	@echo "$(YELLOW)Release (Tekton BuildKit):$(NC)"
	@echo "  make ci-setup            # 套用 infra-bootstrap Tekton base（首次）"
	@echo "  make ci-setup-secrets    # bootstrap ci-tenant-immich-apps secrets"
	@echo "  make ci-apply-release    # 套用 ci/tekton/release/"
	@echo "  make ci-release          # Tekton build immich-line-bot"
	@echo "  make release             # ci-release + helm deploy"
	@echo "  make release-build       # ci-release only"
	@echo ""
	@echo "$(YELLOW)本機開發:$(NC)"
	@echo "  make pf                # Port-forward 30450"
	@echo "  make dev-line-bot      # npm run dev"

# ═══════════════════════════════════════════════════════════════
# 部署
# ═══════════════════════════════════════════════════════════════

deploy-all: ## 部署所有組件
	@echo "$(BLUE)部署 Immich Apps 所有組件...$(NC)"
	@$(MAKE) deploy-server
	@$(MAKE) deploy-line-bot
	@echo "$(GREEN)✓ 所有組件部署完成$(NC)"

deploy-server: ## 部署 Immich server
	@echo "$(BLUE)部署 Immich Server...$(NC)"
	@if [ ! -d "deploy/helm/immich-server" ]; then \
		echo "$(YELLOW)⚠ Helm chart 尚未建立，使用 kubectl manifests$(NC)"; \
		kubectl apply -f deploy/manifests/ --namespace $(NAMESPACE); \
	else \
		helm upgrade --install immich-server ./deploy/helm/immich-server \
			--namespace $(NAMESPACE) \
			--create-namespace \
			--values ./deploy/helm/immich-server/values.yaml; \
	fi
	@echo "$(GREEN)✓ Immich Server 部署完成$(NC)"

deploy-line-bot: ## 部署 LINE Bot (Helm)
	@echo "$(BLUE)部署 LINE Bot (Helm)...$(NC)"
	helm upgrade --install immich-line-bot ./deploy/helm/immich-line-bot \
		--namespace $(NAMESPACE) \
		--create-namespace \
		-f ./deploy/helm/immich-line-bot/values.yaml \
		-f ./deploy/helm/immich-line-bot/values-prod.yaml \
		--set image.tag=$(IMAGE_TAG)
	@echo "$(GREEN)✓ LINE Bot Helm 部署完成$(NC)"

helm-lint: ## Helm chart lint
	helm lint ./deploy/helm/immich-line-bot

# ═══════════════════════════════════════════════════════════════
# Tekton CI / Release
# ═══════════════════════════════════════════════════════════════

ci-setup: ## 套用 infra-bootstrap Tekton 平台設定（首次）
	@INFRA_DIR="$$(dirname $$(pwd))/infra/infra-bootstrap" ; \
	if [ -d "$$INFRA_DIR/60_apps/tekton-ci" ]; then \
	  kubectl apply -k "$$INFRA_DIR/60_apps/tekton-ci/kustomize/base/" ; \
	  echo "$(GREEN)✓ Tekton 平台設定已套用$(NC)" ; \
	else \
	  echo "$(RED)✗ 找不到 infra-bootstrap$(NC)" ; exit 1 ; \
	fi

ci-setup-secrets: ## Bootstrap ci-tenant-immich-apps secrets
	@INFRA_DIR="$$(dirname $$(pwd))/infra/infra-bootstrap" ; \
	bash "$$INFRA_DIR/60_apps/tekton-ci/scripts/bootstrap-immich-apps-tenant-secrets.sh"

ci-apply-release: ## 套用 release Pipeline + Tasks
	kubectl apply -k ci/tekton/release/
	@echo "$(GREEN)✓ Release 設定已套用到 $(TEKTON_TENANT_NS)$(NC)"

ci-release: ## Tekton BuildKit release build（line-bot）
	@bash scripts/release-tekton-build.sh line-bot

ci-status: ## 最近 PipelineRun 狀態
	@kubectl get pipelineruns -n $(TEKTON_TENANT_NS) \
	  --sort-by=.metadata.creationTimestamp \
	  -o custom-columns='NAME:.metadata.name,PIPELINE:.spec.pipelineRef.name,STATUS:.status.conditions[-1].type,AGE:.metadata.creationTimestamp' \
	  | tail -11

ci-logs: ## 最新 release PipelineRun logs
	@LATEST=$$(kubectl get pipelineruns -n $(TEKTON_TENANT_NS) \
	  -l tekton.dev/pipeline=immich-release \
	  --sort-by=.metadata.creationTimestamp \
	  -o jsonpath='{.items[-1].metadata.name}' 2>/dev/null) ; \
	if [ -z "$$LATEST" ]; then \
	  echo "$(YELLOW)找不到 immich-release PipelineRun$(NC)" ; \
	else \
	  echo "PipelineRun: $$LATEST" ; \
	  kubectl -n $(TEKTON_TENANT_NS) logs -l tekton.dev/pipelineRun=$$LATEST -f --max-log-requests=10 ; \
	fi

release: ## Tekton BuildKit build + helm deploy（tag = git short SHA）
	@echo "$(BLUE)Release: $(RELEASE_TAG)$(NC)"
	@bash scripts/release-tekton-build.sh line-bot
	@$(MAKE) deploy-line-bot IMAGE_TAG=$(RELEASE_TAG)

release-build: ## 僅 Tekton build（不 deploy）
	@IMMICH_RELEASE_SKIP_DEPLOY=1 bash scripts/release-tekton-build.sh line-bot

deploy-sync: ## 部署 Photo Sync (CronJob)
	@echo "$(BLUE)部署 Photo Sync...$(NC)"
	@echo "$(YELLOW)⚠ Photo Sync (Mac 本機) 暫不支援 k8s 部署$(NC)"
	@echo "  請參考: docs/PHASE3_PHOTO_SYNC.md"

# ═══════════════════════════════════════════════════════════════
# Build（本機 fallback）
# ═══════════════════════════════════════════════════════════════

build-line-bot: ## 本機 Docker build + push LINE Bot
	@echo "$(BLUE)Building LINE Bot Docker image...$(NC)"
	docker build -f Dockerfile.line-bot -t $(REGISTRY)/immich-line-bot:$(IMAGE_TAG) .
	docker push $(REGISTRY)/immich-line-bot:$(IMAGE_TAG)
	@echo "$(GREEN)✓ LINE Bot image built and pushed$(NC)"

release-line-bot: build-line-bot deploy-line-bot ## 本機 build + Helm deploy

# ═══════════════════════════════════════════════════════════════
# 本機開發
# ═══════════════════════════════════════════════════════════════

pf: ## Port-forward LINE Bot (30450)
	@if [ -f "scripts/dev/pf.sh" ]; then \
		./scripts/dev/pf.sh; \
	else \
		echo "$(RED)✗ scripts/dev/pf.sh 尚未建立$(NC)"; \
	fi

dev-line-bot: ## 本機開發 LINE Bot
	@echo "$(BLUE)啟動 LINE Bot 開發模式...$(NC)"
	npm run dev

logs: ## 查看 k8s logs
	@echo "$(BLUE)=== Immich Server ===$(NC)"
	@kubectl logs -n $(NAMESPACE) -l app=immich-server --tail=50 || echo "$(YELLOW)⚠ Immich Server pods not found$(NC)"
	@echo ""
	@echo "$(BLUE)=== LINE Bot ===$(NC)"
	@kubectl logs -n $(NAMESPACE) -l app=immich-line-bot --tail=50 || echo "$(YELLOW)⚠ LINE Bot pods not found$(NC)"

status: ## 檢查所有組件狀態
	@echo "$(BLUE)=== Immich Apps 狀態 ===$(NC)"
	@kubectl get pods -n $(NAMESPACE) -l 'app in (immich-server,immich-machine-learning,immich-postgres,immich-redis,immich-line-bot)'
	@echo ""
	@kubectl get svc -n $(NAMESPACE)

# ═══════════════════════════════════════════════════════════════
# Lint（Cursor lint-fix-agent 由 Makefile.lint.mk 提供 cursor-lint*）
# ═══════════════════════════════════════════════════════════════

lint: ## 變更檔：Cursor lint-fix-agent + lint-changed-files --fix
	@$(MAKE) cursor-lint-changed

lint-all: ## 全庫：Cursor lint-fix-agent + lint-all.sh
	@$(MAKE) cursor-lint-all

lint-mechanical: ## 變更檔僅腳本（無 Cursor SDK）
	@echo "$(BLUE)🔍 變更檔 lint（lint-changed-files.sh --fix，無 agent）…$(NC)"
	@bash ./scripts/lint-changed-files.sh --fix

lint-changed-files: ## 變更檔 lint（例: make lint-changed-files ARGS='--fix'）
	@bash ./scripts/lint-changed-files.sh $(ARGS)

lint-eslint: ## 全 src ESLint
	@npm run lint

lint-fix: ## 全庫 ESLint --fix + Prettier
	@npm run lint:fix
	@npm run format

git-commit: ## lint + git add + 手動輸入 commit message
	@$(MAKE) lint
	@git add -A
	@echo "$(YELLOW)✍️  請輸入 commit message：$(NC)"
	@read -p "" commit_msg; \
	if [ -z "$$commit_msg" ]; then exit 1; fi; \
	git commit -m "$$commit_msg"

# commit / pull_request 由 Makefile.commit.mk 提供

# ═══════════════════════════════════════════════════════════════
# 測試
# ═══════════════════════════════════════════════════════════════

test: ## 執行測試
	@echo "$(BLUE)Running tests...$(NC)"
	@npm test

clean: ## 清理臨時文件
	@echo "$(BLUE)Cleaning...$(NC)"
	@rm -rf node_modules dist .DS_Store
	@echo "$(GREEN)✓ Clean完成$(NC)"
