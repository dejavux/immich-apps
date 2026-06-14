#!/usr/bin/env bash
# 全庫靜態檢查：ESLint、Prettier、tsc、Markdown、helm lint、make dry-run
#
#   ./scripts/lint-all.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Immich Apps — 全庫 Lint${NC}"
echo -e "${BLUE}========================================${NC}"

HAS_ERROR=false

run_ok() {
  local name="$1"
  shift
  echo -e "\n${BLUE}${name}${NC}"
  if "$@"; then
    echo -e "${GREEN}   通過${NC}"
  else
    echo -e "${RED}   失敗${NC}"
    HAS_ERROR=true
  fi
}

run_ok "eslint（npm run lint）" npm run lint
run_ok "TypeScript（npm run type-check）" npm run type-check
run_ok "photo-sync Python（ruff + flake8 + pylint + pyright）" bash ./scripts/lint-photo-sync-py.sh

if npm run format:check --if-present >/dev/null 2>&1; then
  run_ok "prettier（npm run format:check）" npm run format:check
else
  echo -e "\n${YELLOW}prettier 未設定（npm run format:check），略過${NC}"
fi

if npm run lint:md:check --if-present >/dev/null 2>&1; then
  run_ok "Markdown（npm run lint:md:check）" npm run lint:md:check
else
  echo -e "\n${YELLOW}markdownlint 未設定，略過${NC}"
fi

if npm run spellcheck:md --if-present >/dev/null 2>&1; then
  run_ok "cspell（md, npm run spellcheck:md）" npm run spellcheck:md
else
  echo -e "\n${YELLOW}cspell 未設定，略過${NC}"
fi

if [[ -d deploy/helm/immich-line-bot ]]; then
  run_ok "helm lint immich-line-bot" helm lint deploy/helm/immich-line-bot
fi

_make_bin='make'
command -v gmake >/dev/null 2>&1 && _make_bin='gmake'
run_ok "GNU make (${_make_bin} -n help)" "${_make_bin}" -n help

if command -v gitleaks >/dev/null 2>&1; then
  run_ok "gitleaks dir" gitleaks dir -v .
else
  echo -e "\n${YELLOW}gitleaks 未安裝，略過（brew install gitleaks）${NC}"
fi

echo -e "\n${BLUE}========================================${NC}"
if [[ "$HAS_ERROR" == true ]]; then
  echo -e "${RED}檢查失敗。${NC}"
  exit 1
fi
echo -e "${GREEN}所有檢查通過。${NC}"
exit 0
