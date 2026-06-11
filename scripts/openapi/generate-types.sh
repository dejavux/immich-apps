#!/usr/bin/env bash
# Regenerate TypeScript types from open-api/immich-openapi-specs.json
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SPEC="$ROOT/open-api/immich-openapi-specs.json"
OUT="$ROOT/src/shared/generated/immich-api.d.ts"

if [[ ! -f "$SPEC" ]]; then
  echo "Missing $SPEC — run: bash scripts/openapi/fetch-spec.sh" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
npx openapi-typescript "$SPEC" -o "$OUT"
echo "Generated $OUT"
