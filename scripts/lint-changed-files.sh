#!/usr/bin/env bash
# 只對 git 變更檔跑 ESLint / Prettier / tsc / Markdown / cspell / shellcheck / helm lint / make 語法。
#
#   ./scripts/lint-changed-files.sh
#   ./scripts/lint-changed-files.sh --staged
#   ./scripts/lint-changed-files.sh --fix
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MODE="all"
FIX_MODE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --staged) MODE="staged" ;;
    --fix) FIX_MODE=true ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

echo -e "${BLUE}檢查 Git 變更檔案...${NC}"
if [[ "$MODE" == "staged" ]]; then
  echo "模式: 僅 staged" >&2
else
  echo "模式: 已追蹤變更（對 HEAD）+ 未追蹤新檔" >&2
fi

CHANGED_LINES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && CHANGED_LINES+=("$line")
done < <(
  if [[ "$MODE" == "staged" ]]; then
    git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true
  else
    {
      git diff --name-only --diff-filter=ACMR HEAD 2>/dev/null || true
      git ls-files --others --exclude-standard 2>/dev/null || true
    }
  fi | sort -u
)

FILES=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  [[ -f "$line" ]] && FILES+=("$line")
done < <(printf '%s\n' "${CHANGED_LINES[@]:-}" | sort -u)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo -e "${GREEN}沒有變更的已追蹤／新檔可檢查。${NC}"
  exit 0
fi

should_eslint() {
  local f="$1"
  case "$f" in
    *.ts|*.tsx|*.mts|*.cts|*.js|*.jsx|*.mjs|*.cjs) ;;
    *) return 1 ;;
  esac
  [[ "$f" == dist/* || "$f" == node_modules/* ]] && return 1
  [[ "$f" == src/* || "$f" == scripts/* || "$f" == eslint.config.mjs ]] && return 0
  return 1
}

should_cspell() {
  local f="$1"
  case "$f" in
    *.ts|*.tsx|*.mts|*.cts|*.js|*.jsx|*.mjs|*.cjs|*.md|Makefile|*.mk) ;;
    *) return 1 ;;
  esac
  [[ "$f" == dist/* || "$f" == node_modules/* ]] && return 1
  return 0
}

should_prettier() {
  local f="$1"
  case "$f" in
    *.ts|*.tsx|*.json) ;;
    *.yaml|*.yml)
      [[ "$f" == deploy/helm/*/templates/* ]] && return 1
      ;;
    *) return 1 ;;
  esac
  [[ "$f" == dist/* || "$f" == node_modules/* ]] && return 1
  return 0
}

ESLINT_FILES=()
PRETTIER_FILES=()
MD_FILES=()
SH_FILES=()
SPELL_FILES=()
HELM_CHARTS=()
RUN_TYPECHECK=false
NEED_MAKE_PARSE=false

for f in "${FILES[@]}"; do
  if should_eslint "$f"; then ESLINT_FILES+=("$f"); fi
  if should_prettier "$f"; then PRETTIER_FILES+=("$f"); fi
  if should_cspell "$f"; then SPELL_FILES+=("$f"); fi
  case "$f" in
    *.ts|*.tsx|*.mts|*.cts) RUN_TYPECHECK=true ;;
    *.md) MD_FILES+=("$f") ;;
    *.sh) SH_FILES+=("$f") ;;
    Makefile|*.mk) NEED_MAKE_PARSE=true ;;
    deploy/helm/*/Chart.yaml)
      chart_dir="$(dirname "$f")"
      HELM_CHARTS+=("$chart_dir")
      ;;
  esac
done

# dedupe helm charts
if [[ ${#HELM_CHARTS[@]} -gt 0 ]]; then
  mapfile -t HELM_CHARTS < <(printf '%s\n' "${HELM_CHARTS[@]}" | sort -u)
fi

MAKE_N=0; [[ "$NEED_MAKE_PARSE" == true ]] && MAKE_N=1
echo -e "${BLUE}變更統計:${NC} 共 ${#FILES[@]} 個檔案"
echo "   ESLint: ${#ESLINT_FILES[@]} | Prettier: ${#PRETTIER_FILES[@]} | CSpell: ${#SPELL_FILES[@]} | Markdown: ${#MD_FILES[@]} | shellcheck: ${#SH_FILES[@]} | helm: ${#HELM_CHARTS[@]} | make: ${MAKE_N}"
echo ""

HAS_ERROR=false

if [[ ${#ESLINT_FILES[@]} -gt 0 ]]; then
  echo -e "${BLUE}eslint${NC}"
  _eslint=(npx eslint --no-warn-ignored)
  [[ "$FIX_MODE" == true ]] && _eslint+=(--fix)
  if "${_eslint[@]}" "${ESLINT_FILES[@]}" 2>&1; then
    echo -e "${GREEN}   eslint 通過（${#ESLINT_FILES[@]} 個檔案）${NC}"
  else
    echo -e "${RED}   eslint 失敗${NC}"; HAS_ERROR=true
  fi
  echo ""
fi

if [[ ${#PRETTIER_FILES[@]} -gt 0 ]]; then
  echo -e "${BLUE}prettier${NC}"
  if command -v npx >/dev/null 2>&1 && npx prettier --version >/dev/null 2>&1; then
    if [[ "$FIX_MODE" == true ]]; then
      if npx prettier --write "${PRETTIER_FILES[@]}" 2>&1; then
        echo -e "${GREEN}   prettier 已格式化${NC}"
      else
        echo -e "${RED}   prettier 失敗${NC}"; HAS_ERROR=true
      fi
    else
      if npx prettier --check "${PRETTIER_FILES[@]}" 2>&1; then
        echo -e "${GREEN}   prettier 通過${NC}"
      else
        echo -e "${RED}   prettier 檢查失敗${NC}"; HAS_ERROR=true
      fi
    fi
  else
    echo -e "${YELLOW}   prettier 未安裝，略過（npm install）${NC}"
  fi
  echo ""
fi

if [[ "$RUN_TYPECHECK" == true ]]; then
  echo -e "${BLUE}tsc（npm run type-check）${NC}"
  if npm run type-check 2>&1; then
    echo -e "${GREEN}   type-check 通過${NC}"
  else
    echo -e "${RED}   type-check 失敗${NC}"; HAS_ERROR=true
  fi
  echo ""
fi

if [[ ${#MD_FILES[@]} -gt 0 ]]; then
  echo -e "${BLUE}markdownlint-cli2${NC}"
  if npx markdownlint-cli2 --version >/dev/null 2>&1; then
    _md=(npx markdownlint-cli2)
    [[ "$FIX_MODE" == true ]] && _md+=(--fix)
    _md+=("${MD_FILES[@]}")
    if "${_md[@]}" 2>&1; then
      echo -e "${GREEN}   markdownlint 通過（${#MD_FILES[@]} 個檔案）${NC}"
    else
      echo -e "${RED}   markdownlint 失敗${NC}"; HAS_ERROR=true
    fi
  else
    echo -e "${YELLOW}   markdownlint-cli2 未安裝，略過（npm i -D markdownlint-cli2）${NC}"
  fi
  echo ""
fi

if [[ ${#SH_FILES[@]} -gt 0 ]]; then
  echo -e "${BLUE}shellcheck${NC}"
  if command -v shellcheck >/dev/null 2>&1; then
    if shellcheck -x "${SH_FILES[@]}" 2>&1; then
      echo -e "${GREEN}   shellcheck 通過（${#SH_FILES[@]} 個檔案）${NC}"
    else
      echo -e "${RED}   shellcheck 失敗${NC}"; HAS_ERROR=true
    fi
  else
    echo -e "${YELLOW}   shellcheck 未安裝，略過（brew install shellcheck）${NC}"
  fi
  echo ""
fi

if [[ ${#HELM_CHARTS[@]} -gt 0 ]]; then
  echo -e "${BLUE}helm lint${NC}"
  for chart in "${HELM_CHARTS[@]}"; do
    if helm lint "$chart" 2>&1; then
      echo -e "${GREEN}   helm lint 通過: ${chart}${NC}"
    else
      echo -e "${RED}   helm lint 失敗: ${chart}${NC}"; HAS_ERROR=true
    fi
  done
  echo ""
fi

if [[ "$NEED_MAKE_PARSE" == true ]]; then
  echo -e "${BLUE}make (dry-run)${NC}"
  _make_bin='make'
  command -v gmake >/dev/null 2>&1 && _make_bin='gmake'
  if "${_make_bin}" -n help >/dev/null 2>&1; then
    echo -e "${GREEN}   ${_make_bin} -n help 通過${NC}"
  else
    echo -e "${RED}   ${_make_bin} -n help 失敗${NC}"; HAS_ERROR=true
  fi
  echo ""
fi

if [[ "${SKIP_CSPELL:-}" == "1" ]]; then
  echo -e "${YELLOW}SKIP_CSPELL=1，略過 cspell${NC}"
  echo ""
elif [[ ${#SPELL_FILES[@]} -gt 0 ]]; then
  echo -e "${BLUE}cspell${NC}"
  if npx --yes cspell --no-progress --no-summary "${SPELL_FILES[@]}" 2>&1; then
    echo -e "${GREEN}   cspell 通過（${#SPELL_FILES[@]} 個檔案）${NC}"
  else
    echo -e "${RED}   cspell 失敗${NC}"; HAS_ERROR=true
  fi
  echo ""
fi

if [[ "$HAS_ERROR" == true ]]; then
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}檢查失敗，請修正後再提交。${NC}"
  exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}所有檢查通過。${NC}"
exit 0
