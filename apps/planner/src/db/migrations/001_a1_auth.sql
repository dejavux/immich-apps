-- Planner Phase A1: families, api_keys, usage_daily
-- Apply when DATABASE_URL points to Postgres.

CREATE SCHEMA IF NOT EXISTS planner;

CREATE TABLE IF NOT EXISTS planner.families (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  invite_max_uses INT NOT NULL DEFAULT 5,
  invite_uses INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planner.api_keys (
  id UUID PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES planner.families (id),
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'default',
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_family ON planner.api_keys (family_id);

CREATE TABLE IF NOT EXISTS planner.usage_daily (
  family_id UUID NOT NULL REFERENCES planner.families (id),
  date DATE NOT NULL,
  search_count INT NOT NULL DEFAULT 0,
  extract_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, date)
);

-- Dev seed (optional): INSERT INTO planner.families ...
