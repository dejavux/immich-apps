#!/usr/bin/env bash
# Create and link LINE Rich Menu (one-time or after menu copy changes).
#
# Usage:
#   eval "$(./scripts/dev/load-env-from-op.sh)"
#   ./scripts/line-bot/setup-rich-menu.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ -z "${LINE_CHANNEL_ACCESS_TOKEN:-${LINE_ACCESS_TOKEN:-}}" ]]; then
  eval "$(./scripts/dev/load-env-from-op.sh)"
fi

export LINE_RICH_MENU_AUTO_SETUP=true
npx ts-node -e "
import { ensureDefaultRichMenu } from './src/line-bot/services/rich-menu';
import { env } from './src/line-bot/config/env';

ensureDefaultRichMenu(env.lineAccessToken)
  .then((id) => { console.log('richMenuId', id ?? '(unchanged)'); })
  .catch((err) => { console.error(err); process.exit(1); });
"
