-- Phase A2: shortlist + extract cache (Postgres; memory store used when DATABASE_URL unset)

CREATE TABLE IF NOT EXISTS planner_shortlist (
  family_id UUID NOT NULL,
  tour_id TEXT NOT NULL,
  summary JSONB NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (family_id, tour_id)
);

CREATE INDEX IF NOT EXISTS idx_planner_shortlist_family_added
  ON planner_shortlist (family_id, added_at DESC);

CREATE TABLE IF NOT EXISTS planner_extract_cache (
  cache_key TEXT PRIMARY KEY,
  agency TEXT NOT NULL,
  summary JSONB NOT NULL,
  extracted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_planner_extract_cache_expires
  ON planner_extract_cache (expires_at);
