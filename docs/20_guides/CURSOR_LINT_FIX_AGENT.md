# Cursor lint-fix-agent — immich-apps 整合指南

本 repo 透過 [cursor-lint-fix-agent](https://github.com/dejavux/cursor-lint-fix-agent)
在 `make lint` 時自動修復 lint 錯誤，並用 Cursor SDK 生成 commit / PR。

Upstream 通用文件：[`docs/CONSUMER_ONBOARDING.md`](https://github.com/dejavux/cursor-lint-fix-agent/blob/main/docs/CONSUMER_ONBOARDING.md)

## 指令對照

| 指令 | 用途 | 依賴 |
|------|------|------|
| `make lint` | 變更檔 lint + Cursor agent 自動修復 | cursor-lint-fix-agent、`.env` |
| `make lint-mechanical` | 僅腳本 lint（無 SDK；CI / 離線） | npm、eslint |
| `make lint-all` | 全庫 lint + agent | 同上 |
| `make commit` | lint → git add → Cursor SDK conventional commit | `CURSOR_API_KEY` |
| `make pull_request` | lint → commit → push → PR → merge `main` | `gh`、`CURSOR_API_KEY` |
| `make release` | Tekton BuildKit build + helm deploy | kubectl（Tekton 就緒前 fallback docker） |

**`make release` 不會呼叫 lint agent。** Release 前請手動 `make lint` 或 `make lint-mechanical`。

## 一次性設定

### 1. Clone toolkit

```bash
gh repo clone dejavux/cursor-lint-fix-agent ~/workspace/cursor-lint-fix-agent
cd ~/workspace/cursor-lint-fix-agent
npm install
```

### 2. 本 repo `.env`

```bash
cp .env.example .env
# 編輯 Cursor SDK 一節：
#   CURSOR_API_KEY=cursor_...
#   CURSOR_MODEL=default
```

### 3. 安裝 dev 依賴

```bash
npm install
```

### 4. 驗證

```bash
make lint-mechanical              # 無 SDK
LINT_FIX_ARGS="--dry-run" make cursor-lint-changed-run
make lint                         # 含 agent
```

## Makefile 整合（已設定）

```makefile
CURSOR_LINT_FIX_AGENT_DIR ?= $(HOME)/workspace/cursor-lint-fix-agent
LINT_TARGET_PREFIX := cursor-
LINT_CHANGED_CMD = bash ./scripts/lint-changed-files.sh --fix
LINT_ALL_CMD = bash ./scripts/lint-all.sh
include $(CURSOR_LINT_FIX_AGENT_DIR)/share/Makefile.lint.mk
include $(CURSOR_LINT_FIX_AGENT_DIR)/share/Makefile.commit.mk
```

Lint 腳本檢查：ESLint、Prettier、tsc、markdownlint、shellcheck、helm lint（變更 chart 時）。

## Git 工作流

```bash
# 日常開發
make lint
make commit

# 一鍵 PR（預設 merge 回 main）
make pull_request

# 只開 PR、不 merge
PR_SKIP_MERGE=1 make pull_request

# 無 Cursor API（例如 CI）
AUTO_COMMIT_LINT_TARGET=lint-mechanical make commit
```

本 repo 預設 base branch 為 **`main`**（`PR_BASE_BRANCH=main`）。

## Release 工作流

```bash
# Tekton 就緒後（ci/tekton/release/ + ci-tenant-immich-apps）
make release

# 僅 build 映像
make release-build

# Tekton 未完成時：自動 fallback 本機 docker build + push
IMMICH_RELEASE_SKIP_DEPLOY=1 make release-build
```

## 疑難排解

| 症狀 | 處理 |
|------|------|
| `cursor-lint-fix-agent not found` | clone + `npm install`（見上方） |
| `CURSOR_API_KEY 未設定` | 編輯 `.env` |
| Agent quota / ERROR | `LINT_FIX_ARGS="--model default" make lint` |
| `gh 未登入` | `gh auth login` |
| lint 仍失敗 | 手動修正後 `make lint-mechanical` |

## 參考

- fuqi 整合：`fuqi-asset-manager/docs/20_guides/CURSOR_LINT_FIX_AGENT.md`
- K8s release：`docs/20_guides/infra/K8S_DEPLOYMENT.md`
