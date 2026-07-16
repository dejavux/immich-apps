import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { Pool, PoolClient } from "pg";

const MIGRATION_FALLBACK_DIRS = [
  path.join(process.cwd(), "apps/planner/src/db/migrations"),
  path.join(process.cwd(), "src/db/migrations"),
];

async function resolveMigrationsDir(): Promise<string> {
  for (const dir of MIGRATION_FALLBACK_DIRS) {
    try {
      await access(dir);
      return dir;
    } catch {
      // try next candidate
    }
  }
  throw new Error("Planner migrations directory not found");
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS planner;
    CREATE TABLE IF NOT EXISTS planner.schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function listMigrationFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

export async function runPlannerMigrations(pool: Pool): Promise<void> {
  const migrationsDir = await resolveMigrationsDir();
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await client.query<{ version: string }>(
      "SELECT version FROM planner.schema_migrations",
    );
    const appliedSet = new Set(applied.rows.map((row) => row.version));

    for (const file of await listMigrationFiles(migrationsDir)) {
      const version = file.replace(/\.sql$/, "");
      if (appliedSet.has(version)) {
        continue;
      }
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO planner.schema_migrations (version) VALUES ($1)",
          [version],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
