import "dotenv/config";

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: optionalInt("PORT", 3001),
  nodeEnv: optional("NODE_ENV", "development"),
  serviceName: "family-memories-planner",
  databaseUrl: optional("DATABASE_URL", ""),
  /** true when DATABASE_URL is non-empty (Postgres store) */
  postgresEnabled: Boolean(optional("DATABASE_URL", "")),
  redisUrl: optional("REDIS_URL", ""),
  wizardSessionTtlHours: optionalInt("WIZARD_SESSION_TTL_HOURS", 24),
  quotaSearchPerDay: optionalInt("QUOTA_SEARCH_PER_DAY", 30),
  quotaExtractPerDay: optionalInt("QUOTA_EXTRACT_PER_DAY", 20),
  extractCacheTtlHours: optionalInt("EXTRACT_CACHE_TTL_HOURS", 12),
  genericExtractEnabled: optional("GENERIC_EXTRACT_ENABLED", "false").toLowerCase() === "true",
  genericExtractLlmUrl: optional("GENERIC_EXTRACT_LLM_URL", ""),
  /** 開發用種子邀請碼（memory store） */
  seedInviteCode: optional("PLANNER_SEED_INVITE_CODE", "FAMILY-DEMO-2026"),
};
