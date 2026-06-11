#!/usr/bin/env bash
# Fetch pinned Immich OpenAPI spec from upstream (default: v2.0.1).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="${IMMICH_OPENAPI_VERSION:-2.0.1}"
OUT="$ROOT/open-api/immich-openapi-specs.json"
URL="https://raw.githubusercontent.com/immich-app/immich/v${VERSION}/open-api/immich-openapi-specs.json"

echo "Fetching Immich OpenAPI v${VERSION}..."
curl -fsSL "$URL" -o "$OUT"
echo "Wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
