import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { env } from "../config/env.js";
import { generateApiKey, hashApiKey } from "./crypto.js";
import { runPlannerMigrations } from "./migrate.js";
import type {
  FamilyAuthContext,
  FamilyRecord,
  PlannerStore,
  ShortlistRecord,
  UsageDailyRecord,
} from "./types.js";

type FamilyRow = {
  id: string;
  name: string;
  invite_code: string;
  invite_max_uses: number;
  invite_uses: number;
  created_at: Date;
};

type UsageRow = {
  family_id: string;
  date: Date;
  search_count: number;
  extract_count: number;
};

type ShortlistRow = {
  family_id: string;
  tour_id: string;
  summary: ShortlistRecord["summary"];
  added_at: Date;
};

function mapFamily(row: FamilyRow): FamilyRecord {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    inviteMaxUses: row.invite_max_uses,
    inviteUses: row.invite_uses,
    createdAt: row.created_at.toISOString(),
  };
}

function mapUsage(row: UsageRow): UsageDailyRecord {
  return {
    familyId: row.family_id,
    date: row.date.toISOString().slice(0, 10),
    searchCount: row.search_count,
    extractCount: row.extract_count,
  };
}

function mapShortlist(row: ShortlistRow): ShortlistRecord {
  return {
    familyId: row.family_id,
    tourId: row.tour_id,
    summary: row.summary,
    addedAt: row.added_at.toISOString(),
  };
}

export class PostgresPlannerStore implements PlannerStore {
  readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async init(): Promise<void> {
    await runPlannerMigrations(this.pool);
    await this.seedDemoFamilyIfEmpty();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async seedDemoFamilyIfEmpty(): Promise<void> {
    const existing = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM planner.families",
    );
    if (Number.parseInt(existing.rows[0]?.count ?? "0", 10) > 0) {
      return;
    }
    await this.pool.query(
      `INSERT INTO planner.families (id, name, invite_code, invite_max_uses, invite_uses)
       VALUES ($1, $2, $3, $4, 0)`,
      [randomUUID(), "Demo Family", env.seedInviteCode, 5],
    );
  }

  async findFamilyByInviteCode(inviteCode: string): Promise<FamilyRecord | null> {
    const result = await this.pool.query<FamilyRow>(
      `SELECT id, name, invite_code, invite_max_uses, invite_uses, created_at
       FROM planner.families
       WHERE UPPER(invite_code) = UPPER($1)`,
      [inviteCode.trim()],
    );
    const row = result.rows[0];
    return row ? mapFamily(row) : null;
  }

  async findFamilyById(id: string): Promise<FamilyRecord | null> {
    const result = await this.pool.query<FamilyRow>(
      `SELECT id, name, invite_code, invite_max_uses, invite_uses, created_at
       FROM planner.families WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapFamily(row) : null;
  }

  async redeemInvite(input: {
    inviteCode: string;
    label?: string;
  }): Promise<
    | { family: FamilyRecord; apiKey: string }
    | { error: "invalid_invite" | "invite_exhausted" }
  > {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const familyResult = await client.query<FamilyRow>(
        `SELECT id, name, invite_code, invite_max_uses, invite_uses, created_at
         FROM planner.families
         WHERE UPPER(invite_code) = UPPER($1)
         FOR UPDATE`,
        [input.inviteCode.trim()],
      );
      const familyRow = familyResult.rows[0];
      if (!familyRow) {
        await client.query("ROLLBACK");
        return { error: "invalid_invite" };
      }
      if (familyRow.invite_uses >= familyRow.invite_max_uses) {
        await client.query("ROLLBACK");
        return { error: "invite_exhausted" };
      }

      await client.query(
        "UPDATE planner.families SET invite_uses = invite_uses + 1 WHERE id = $1",
        [familyRow.id],
      );
      familyRow.invite_uses += 1;

      const plaintext = generateApiKey();
      await client.query(
        `INSERT INTO planner.api_keys (id, family_id, key_hash, label)
         VALUES ($1, $2, $3, $4)`,
        [
          randomUUID(),
          familyRow.id,
          hashApiKey(plaintext),
          input.label?.trim() || "default",
        ],
      );
      await client.query("COMMIT");
      return { family: mapFamily(familyRow), apiKey: plaintext };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async resolveApiKey(plaintextKey: string): Promise<FamilyAuthContext | null> {
    const result = await this.pool.query<{
      api_key_id: string;
      label: string;
      id: string;
      name: string;
      invite_code: string;
      invite_max_uses: number;
      invite_uses: number;
      created_at: Date;
    }>(
      `SELECT k.id AS api_key_id, k.label,
              f.id, f.name, f.invite_code, f.invite_max_uses, f.invite_uses, f.created_at
       FROM planner.api_keys k
       JOIN planner.families f ON f.id = k.family_id
       WHERE k.key_hash = $1 AND k.revoked_at IS NULL`,
      [hashApiKey(plaintextKey)],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      family: mapFamily({
        id: row.id,
        name: row.name,
        invite_code: row.invite_code,
        invite_max_uses: row.invite_max_uses,
        invite_uses: row.invite_uses,
        created_at: row.created_at,
      }),
      apiKeyId: row.api_key_id,
      apiKeyLabel: row.label,
    };
  }

  async getUsageDaily(familyId: string, date: string): Promise<UsageDailyRecord> {
    const result = await this.pool.query<UsageRow>(
      `SELECT family_id, date, search_count, extract_count
       FROM planner.usage_daily
       WHERE family_id = $1 AND date = $2::date`,
      [familyId, date],
    );
    const row = result.rows[0];
    if (!row) {
      return { familyId, date, searchCount: 0, extractCount: 0 };
    }
    return mapUsage(row);
  }

  async incrementSearchCount(familyId: string, date: string): Promise<UsageDailyRecord> {
    const result = await this.pool.query<UsageRow>(
      `INSERT INTO planner.usage_daily (family_id, date, search_count, extract_count)
       VALUES ($1, $2::date, 1, 0)
       ON CONFLICT (family_id, date)
       DO UPDATE SET search_count = planner.usage_daily.search_count + 1
       RETURNING family_id, date, search_count, extract_count`,
      [familyId, date],
    );
    return mapUsage(result.rows[0]);
  }

  async incrementExtractCount(familyId: string, date: string): Promise<UsageDailyRecord> {
    const result = await this.pool.query<UsageRow>(
      `INSERT INTO planner.usage_daily (family_id, date, search_count, extract_count)
       VALUES ($1, $2::date, 0, 1)
       ON CONFLICT (family_id, date)
       DO UPDATE SET extract_count = planner.usage_daily.extract_count + 1
       RETURNING family_id, date, search_count, extract_count`,
      [familyId, date],
    );
    return mapUsage(result.rows[0]);
  }

  async listShortlist(familyId: string): Promise<ShortlistRecord[]> {
    const result = await this.pool.query<ShortlistRow>(
      `SELECT family_id, tour_id, summary, added_at
       FROM planner.shortlist
       WHERE family_id = $1
       ORDER BY added_at DESC`,
      [familyId],
    );
    return result.rows.map(mapShortlist);
  }

  async findShortlistItem(familyId: string, tourId: string): Promise<ShortlistRecord | null> {
    const result = await this.pool.query<ShortlistRow>(
      `SELECT family_id, tour_id, summary, added_at
       FROM planner.shortlist
       WHERE family_id = $1 AND tour_id = $2`,
      [familyId, tourId],
    );
    const row = result.rows[0];
    return row ? mapShortlist(row) : null;
  }

  async addShortlist(input: {
    familyId: string;
    tourId: string;
    summary: ShortlistRecord["summary"];
  }): Promise<ShortlistRecord> {
    const result = await this.pool.query<ShortlistRow>(
      `INSERT INTO planner.shortlist (family_id, tour_id, summary, added_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (family_id, tour_id)
       DO UPDATE SET summary = EXCLUDED.summary, added_at = NOW()
       RETURNING family_id, tour_id, summary, added_at`,
      [input.familyId, input.tourId, JSON.stringify(input.summary)],
    );
    return mapShortlist(result.rows[0]);
  }

  async removeShortlist(familyId: string, tourId: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM planner.shortlist WHERE family_id = $1 AND tour_id = $2",
      [familyId, tourId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
