import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number.parseInt(optional("PORT", "3000"), 10),
  nodeEnv: optional("NODE_ENV", "development"),
  lineChannelSecret: required("LINE_CHANNEL_SECRET"),
  lineAccessToken: (() => {
    const token =
      process.env.LINE_CHANNEL_ACCESS_TOKEN ?? process.env.LINE_ACCESS_TOKEN;
    if (!token) {
      throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_ACCESS_TOKEN");
    }
    return token;
  })(),
  immichBaseUrl: optional("IMMICH_BASE_URL", "https://immich.3q.fi").replace(
    /\/$/,
    "",
  ),
  immichApiKey: required("IMMICH_API_KEY"),
  immichWebUrl: optional(
    "IMMICH_WEB_URL",
    optional("IMMICH_BASE_URL", "https://immich.3q.fi"),
  ).replace(/\/$/, ""),
  /** Album for LINE uploads (Immich /api/albums). Empty = skip album assignment. */
  immichLineAlbumName: optional("IMMICH_LINE_ALBUM_NAME", "LINE Inbox"),
  /** Poll GET /api/assets/{id} until hasMetadata; 0 = skip. */
  assetMetadataWaitMs: Number.parseInt(
    optional("ASSET_METADATA_WAIT_MS", "8000"),
    10,
  ),
  photoSearchEnabled: optional("PHOTO_SEARCH_ENABLED", "true") === "true",
  qwenBaseUrl: optional(
    "QWEN_BASE_URL",
    "http://qwen-coder.local-llm.svc.cluster.local:8001/v1",
  ).replace(/\/$/, ""),
  qwenApiKey: optional("QWEN_API_KEY", ""),
  qwenModel: optional("QWEN_MODEL", "default"),
  qwenTimeoutMs: Number.parseInt(optional("QWEN_TIMEOUT_MS", "30000"), 10),
  searchMaxResults: Number.parseInt(optional("SEARCH_MAX_RESULTS", "5"), 10),
  searchAgeWindowDays: Number.parseInt(
    optional("SEARCH_AGE_WINDOW_DAYS", "45"),
    10,
  ),
  searchSessionTtlMs: Number.parseInt(
    optional("SEARCH_SESSION_TTL_MS", "1800000"),
    10,
  ),
  /** Comma-separated nickname:ImmichName pairs, e.g. 小蕊:rayna */
  searchPersonAliases: optional("SEARCH_PERSON_ALIASES", "小蕊:rayna"),
  /** Public HTTPS base URL for LINE-accessible media (thumbnail proxy). */
  lineBotPublicUrl: optional(
    "LINE_BOT_PUBLIC_URL",
    "https://immich-bot.3q.fi",
  ).replace(/\/$/, ""),
  lineRichMenuAutoSetup:
    optional("LINE_RICH_MENU_AUTO_SETUP", "false") === "true",
};
