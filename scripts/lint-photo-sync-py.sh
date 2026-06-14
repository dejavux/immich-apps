#!/usr/bin/env bash
# ruff + flake8 + pylint + pyright for scripts/photo-sync/*.py
# （對齊 infra-bootstrap lint-git-changed run_py 子集）
#
#   ./scripts/lint-photo-sync-py.sh
#   ./scripts/lint-photo-sync-py.sh --fix
#   ./scripts/lint-photo-sync-py.sh scripts/photo-sync/tier_policy_runner.py
#
# 環境變數：
#   SKIP_RUFF=1     # 略過 ruff
#   SKIP_FLAKE8=1   # 略過 flake8
#   SKIP_PYLINT=1   # 略過 pylint
#   SKIP_PYRIGHT=1  # 略過 pyright
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PHOTO_SYNC_PREFIX="scripts/photo-sync/"
PHOTO_SYNC_PY_PATH="${ROOT}/scripts/photo-sync"
FIX_MODE=false
FILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fix) FIX_MODE=true; shift ;;
    --) shift; FILES+=("$@"); break ;;
    *) FILES+=("$1"); shift ;;
  esac
done

_lint_py_try_pip_user() {
  python3 -m pip install --user --disable-pip-version-check "$@" >/dev/null 2>&1
}

should_photo_sync_py() {
  local f="$1"
  [[ "$f" == "${PHOTO_SYNC_PREFIX}"*.py ]]
}

if [[ ${#FILES[@]} -eq 0 ]]; then
  while IFS= read -r f; do
    FILES+=("$f")
  done < <(find scripts/photo-sync -maxdepth 1 -name '*.py' | sort)
fi

PY_FILES=()
for f in "${FILES[@]}"; do
  if should_photo_sync_py "$f" && [[ -f "$f" ]]; then
    PY_FILES+=("$f")
  fi
done

if [[ ${#PY_FILES[@]} -eq 0 ]]; then
  exit 0
fi

export PYTHONPATH="${PHOTO_SYNC_PY_PATH}${PYTHONPATH:+:$PYTHONPATH}"

echo -e "${BLUE}photo-sync Python（${#PY_FILES[@]} 個檔案）${NC}"
HAS_ERROR=false

if [[ "${SKIP_RUFF:-}" == "1" ]]; then
  echo -e "${YELLOW}   略過 ruff（SKIP_RUFF=1）${NC}"
else
  _ruff_bin=()
  if command -v ruff >/dev/null 2>&1; then
    _ruff_bin=(ruff)
  fi
  if [[ ${#_ruff_bin[@]} -eq 0 ]]; then
    _lint_py_try_pip_user ruff
    command -v ruff >/dev/null 2>&1 && _ruff_bin=(ruff)
  fi
  if [[ ${#_ruff_bin[@]} -eq 0 ]]; then
    echo -e "${YELLOW}   略過 ruff（未安裝；pip install ruff）${NC}"
  else
    echo -e "${BLUE}   ruff check${NC}"
    _ruff_args=(check)
    [[ "$FIX_MODE" == true ]] && _ruff_args+=(--fix)
    if "${_ruff_bin[@]}" "${_ruff_args[@]}" "${PY_FILES[@]}"; then
      :
    else
      HAS_ERROR=true
    fi
    if [[ "$FIX_MODE" == true ]]; then
      echo -e "${BLUE}   ruff format${NC}"
      if "${_ruff_bin[@]}" format "${PY_FILES[@]}"; then
        :
      else
        HAS_ERROR=true
      fi
    fi
  fi
fi

if [[ "${SKIP_FLAKE8:-}" == "1" ]]; then
  echo -e "${YELLOW}   略過 flake8（SKIP_FLAKE8=1）${NC}"
else
  if command -v flake8 >/dev/null 2>&1; then
    echo -e "${BLUE}   flake8${NC}"
    if flake8 "${PY_FILES[@]}"; then
      :
    else
      HAS_ERROR=true
    fi
  else
    _lint_py_try_pip_user flake8
    if command -v flake8 >/dev/null 2>&1; then
      echo -e "${BLUE}   flake8${NC}"
      if flake8 "${PY_FILES[@]}"; then
        :
      else
        HAS_ERROR=true
      fi
    else
      echo -e "${YELLOW}   略過 flake8（未安裝；pip install flake8）${NC}"
    fi
  fi
fi

if [[ "${SKIP_PYLINT:-}" == "1" ]]; then
  echo -e "${YELLOW}   略過 pylint（SKIP_PYLINT=1）${NC}"
else
  if command -v pylint >/dev/null 2>&1; then
    echo -e "${BLUE}   pylint${NC}"
    if pylint "${PY_FILES[@]}"; then
      :
    else
      HAS_ERROR=true
    fi
  else
    _lint_py_try_pip_user pylint
    if command -v pylint >/dev/null 2>&1; then
      echo -e "${BLUE}   pylint${NC}"
      if pylint "${PY_FILES[@]}"; then
        :
      else
        HAS_ERROR=true
      fi
    else
      echo -e "${YELLOW}   略過 pylint（未安裝；pip install pylint）${NC}"
    fi
  fi
fi

if [[ "${SKIP_PYRIGHT:-}" == "1" ]]; then
  echo -e "${YELLOW}   略過 pyright（SKIP_PYRIGHT=1）${NC}"
else
  _pyright_bin=()
  if command -v pyright >/dev/null 2>&1; then
    _pyright_bin=(pyright)
  elif command -v npx >/dev/null 2>&1; then
    _pyright_bin=(npx --yes pyright)
  fi
  if [[ ${#_pyright_bin[@]} -eq 0 ]]; then
    echo -e "${YELLOW}   略過 pyright（未安裝；npm i -g pyright 或 npx pyright）${NC}"
  else
    echo -e "${BLUE}   pyright${NC}"
    if "${_pyright_bin[@]}" "${PY_FILES[@]}"; then
      :
    else
      HAS_ERROR=true
    fi
  fi
fi

if [[ "$HAS_ERROR" == true ]]; then
  echo -e "${RED}   photo-sync Python lint 失敗${NC}"
  exit 1
fi

echo -e "${GREEN}   photo-sync Python lint 通過（${#PY_FILES[@]} 個檔案）${NC}"
exit 0
