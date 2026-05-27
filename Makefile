# Immich Apps - Makefile
# 統一管理 Immich server + LINE Bot + Photo Sync

.PHONY: help build test deploy clean logs status \
	deploy-all deploy-server deploy-line-bot deploy-sync \
	build-line-bot release-line-bot \
	lint lint-all lint-mechanical lint-eslint \
	cursor-lint cursor-lint-changed cursor-lint-all \
	commit pull_request pf dev-line-bot

# 默認目標
.DEFAULT_GOAL := help

# 配置
NAMESPACE ?= immich
IMAGE_TAG ?= latest
REGISTRY ?= registry.3q.fi

# 顏色
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Cursor lint-fix-agent (TODO: 設定後啟用)
# LINT_TARGET_PREFIX := cursor-
# HOME_CURSOR_LINT_AGENT_SH := $(HOME)/workspace/cursor-lint-fix-agent/share/lint_fix_agent.sh
# LOCAL_CURSOR_LINT_AGENT_SH := $(abspath scripts/cursor-lint-fix-agent-bridge/share/lint_fix_agent.sh)
# ifeq ($(wildcard $(HOME_CURSOR_LINT_AGENT_SH)),)
# export LINT_FIX_AGENT_SH := $(LOCAL_CURSOR_LINT_AGENT_SH)
# else
# export LINT_FIX_AGENT_SH := $(HOME_CURSOR_LINT_AGENT_SH)
# endif
# include $(abspath scripts/cursor-lint-fix-agent-bridge/share/Makefile.lint.mk)

help: ## 顯示幫助信息
	@echo "$(BLUE)Immich Apps - 可用命令:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)部署:$(NC)"
	@echo "  make deploy-all        # 部署所有組件（server + LINE Bot + sync）"
	@echo "  make deploy-server     # 部署 Immich server"
	@echo "  make deploy-line-bot   # 部署 LINE Bot"
	@echo "  make deploy-sync       # 部署 Photo Sync"
	@echo ""
	@echo "$(YELLOW)Build & Release:$(NC)"
	@echo "  make build-line-bot    # Docker build LINE Bot"
	@echo "  make release-line-bot  # Build + Deploy LINE Bot"
	@echo ""
	@echo "$(YELLOW)本機開發:$(NC)"
	@echo "  make pf                # Port-forward (30430-30439)"
	@echo "  make dev-line-bot      # 本機開發 LINE Bot"
	@echo "  make logs              # 查看 k8s logs"
	@echo ""
	@echo "$(YELLOW)Lint & Git:$(NC)"
	@echo "  make lint              # 變更檔 lint"
	@echo "  make lint-all          # 全庫 lint"
	@echo "  make commit            # Lint + AI commit"
	@echo "  make pull_request      # Lint → commit → PR → merge"

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

deploy-line-bot: ## 部署 LINE Bot
	@echo "$(BLUE)部署 LINE Bot...$(NC)"
	@if [ ! -d "deploy/helm/immich-line-bot/templates" ] || [ -z "$$(ls -A deploy/helm/immich-line-bot/templates)" ]; then \
		echo "$(YELLOW)⚠ LINE Bot Helm chart 尚未建立$(NC)"; \
	else \
		helm upgrade --install immich-line-bot ./deploy/helm/immich-line-bot \
			--namespace $(NAMESPACE) \
			--values ./deploy/helm/immich-line-bot/values.yaml; \
		echo "$(GREEN)✓ LINE Bot 部署完成$(NC)"; \
	fi

deploy-sync: ## 部署 Photo Sync (CronJob)
	@echo "$(BLUE)部署 Photo Sync...$(NC)"
	@echo "$(YELLOW)⚠ Photo Sync (Mac 本機) 暫不支援 k8s 部署$(NC)"
	@echo "  請參考: docs/PHASE3_PHOTO_SYNC.md"

# ═══════════════════════════════════════════════════════════════
# Build & Release
# ═══════════════════════════════════════════════════════════════

build-line-bot: ## Build LINE Bot Docker image
	@echo "$(BLUE)Building LINE Bot Docker image...$(NC)"
	docker build -f Dockerfile.line-bot -t $(REGISTRY)/immich-line-bot:$(IMAGE_TAG) .
	docker push $(REGISTRY)/immich-line-bot:$(IMAGE_TAG)
	@echo "$(GREEN)✓ LINE Bot image built and pushed$(NC)"

release-line-bot: build-line-bot deploy-line-bot ## Build + Deploy LINE Bot

# ═══════════════════════════════════════════════════════════════
# 本機開發
# ═══════════════════════════════════════════════════════════════

pf: ## Port-forward (30430-30439)
	@if [ -f "scripts/dev/pf.sh" ]; then \
		./scripts/dev/pf.sh; \
	else \
		echo "$(RED)✗ scripts/dev/pf.sh 尚未建立$(NC)"; \
		echo "  建立後可執行: make pf"; \
	fi

dev-line-bot: ## 本機開發 LINE Bot
	@echo "$(BLUE)啟動 LINE Bot 開發模式...$(NC)"
	cd src/line-bot && npm run dev

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
# Lint & Git
# ═══════════════════════════════════════════════════════════════

lint: ## 變更檔 lint
	@echo "$(BLUE)Linting changed files...$(NC)"
	@if [ -f "package.json" ]; then \
		npm run lint; \
	else \
		echo "$(YELLOW)⚠ package.json not found, skipping lint$(NC)"; \
	fi

lint-all: ## 全庫 lint
	@echo "$(BLUE)Linting all files...$(NC)"
	@if [ -f "package.json" ]; then \
		npm run lint; \
	else \
		echo "$(YELLOW)⚠ package.json not found, skipping lint$(NC)"; \
	fi

lint-mechanical: lint ## 變更檔 lint（無 Cursor SDK）

lint-eslint: ## ESLint (src/)
	@if [ -d "src/line-bot" ]; then \
		cd src/line-bot && npm run lint; \
	else \
		echo "$(YELLOW)⚠ src/line-bot not found$(NC)"; \
	fi

commit: ## Lint + AI commit
	@echo "$(BLUE)Lint + Git commit...$(NC)"
	@$(MAKE) lint
	@git add .
	@echo "$(YELLOW)請手動輸入 commit message（未來將整合 AI commit）$(NC)"
	@git status

pull_request: commit ## Lint → commit → PR → merge
	@echo "$(BLUE)Creating pull request...$(NC)"
	@echo "$(YELLOW)TODO: 整合 scripts/create-pull-request.sh$(NC)"

# ═══════════════════════════════════════════════════════════════
# 測試
# ═══════════════════════════════════════════════════════════════

test: ## 執行測試
	@echo "$(BLUE)Running tests...$(NC)"
	@if [ -f "package.json" ]; then \
		npm test; \
	else \
		echo "$(YELLOW)⚠ Tests not configured$(NC)"; \
	fi

# ═══════════════════════════════════════════════════════════════
# 清理
# ═══════════════════════════════════════════════════════════════

clean: ## 清理臨時文件
	@echo "$(BLUE)Cleaning...$(NC)"
	@rm -rf node_modules dist .DS_Store
	@echo "$(GREEN)✓ Clean完成$(NC)"
