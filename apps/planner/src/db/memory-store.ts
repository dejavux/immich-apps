import { createHash, randomBytes, randomUUID } from "node:crypto";

import { env } from "../config/env.js";
import type {
  ApiKeyRecord,
  FamilyAuthContext,
  FamilyRecord,
  PlannerStore,
  ShortlistRecord,
  UsageDailyRecord,
} from "./types.js";

function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

function generateApiKey(): string {
  return `fmp_${randomBytes(24).toString("base64url")}`;
}

export class MemoryPlannerStore implements PlannerStore {
  private families = new Map<string, FamilyRecord>();
  private familiesByInvite = new Map<string, FamilyRecord>();
  private apiKeys = new Map<string, ApiKeyRecord>();
  private usage = new Map<string, UsageDailyRecord>();
  private shortlist = new Map<string, ShortlistRecord>();

  constructor(seedDemo = env.nodeEnv !== "test") {
    if (seedDemo) {
      this.seedDemoFamily();
    }
  }

  private seedDemoFamily(): void {
    const id = randomUUID();
    const family: FamilyRecord = {
      id,
      name: "Demo Family",
      inviteCode: env.seedInviteCode,
      inviteMaxUses: 5,
      inviteUses: 0,
      createdAt: new Date().toISOString(),
    };
    this.families.set(id, family);
    this.familiesByInvite.set(family.inviteCode.toUpperCase(), family);
  }

  async findFamilyByInviteCode(inviteCode: string): Promise<FamilyRecord | null> {
    return this.familiesByInvite.get(inviteCode.trim().toUpperCase()) ?? null;
  }

  async findFamilyById(id: string): Promise<FamilyRecord | null> {
    return this.families.get(id) ?? null;
  }

  async redeemInvite(input: {
    inviteCode: string;
    label?: string;
  }): Promise<
    | { family: FamilyRecord; apiKey: string }
    | { error: "invalid_invite" | "invite_exhausted" }
  > {
    const family = await this.findFamilyByInviteCode(input.inviteCode);
    if (!family) {
      return { error: "invalid_invite" };
    }
    if (family.inviteUses >= family.inviteMaxUses) {
      return { error: "invite_exhausted" };
    }

    family.inviteUses += 1;
    const plaintext = generateApiKey();
    const record: ApiKeyRecord = {
      id: randomUUID(),
      familyId: family.id,
      keyHash: hashApiKey(plaintext),
      label: input.label?.trim() || "default",
      revokedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.apiKeys.set(record.keyHash, record);
    return { family, apiKey: plaintext };
  }

  async resolveApiKey(plaintextKey: string): Promise<FamilyAuthContext | null> {
    const keyHash = hashApiKey(plaintextKey);
    const record = this.apiKeys.get(keyHash);
    if (!record || record.revokedAt) {
      return null;
    }
    const family = this.families.get(record.familyId);
    if (!family) {
      return null;
    }
    return {
      family,
      apiKeyId: record.id,
      apiKeyLabel: record.label,
    };
  }

  private usageKey(familyId: string, date: string): string {
    return `${familyId}:${date}`;
  }

  async getUsageDaily(familyId: string, date: string): Promise<UsageDailyRecord> {
    const key = this.usageKey(familyId, date);
    return (
      this.usage.get(key) ?? {
        familyId,
        date,
        searchCount: 0,
        extractCount: 0,
      }
    );
  }

  async incrementSearchCount(familyId: string, date: string): Promise<UsageDailyRecord> {
    const current = await this.getUsageDaily(familyId, date);
    const next = { ...current, searchCount: current.searchCount + 1 };
    this.usage.set(this.usageKey(familyId, date), next);
    return next;
  }

  async incrementExtractCount(familyId: string, date: string): Promise<UsageDailyRecord> {
    const current = await this.getUsageDaily(familyId, date);
    const next = { ...current, extractCount: current.extractCount + 1 };
    this.usage.set(this.usageKey(familyId, date), next);
    return next;
  }

  private shortlistKey(familyId: string, tourId: string): string {
    return `${familyId}:${tourId}`;
  }

  async listShortlist(familyId: string): Promise<ShortlistRecord[]> {
    return [...this.shortlist.values()]
      .filter((item) => item.familyId === familyId)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  async findShortlistItem(familyId: string, tourId: string): Promise<ShortlistRecord | null> {
    return this.shortlist.get(this.shortlistKey(familyId, tourId)) ?? null;
  }

  async addShortlist(input: {
    familyId: string;
    tourId: string;
    summary: ShortlistRecord["summary"];
  }): Promise<ShortlistRecord> {
    const record: ShortlistRecord = {
      familyId: input.familyId,
      tourId: input.tourId,
      summary: input.summary,
      addedAt: new Date().toISOString(),
    };
    this.shortlist.set(this.shortlistKey(input.familyId, input.tourId), record);
    return record;
  }

  async removeShortlist(familyId: string, tourId: string): Promise<boolean> {
    return this.shortlist.delete(this.shortlistKey(familyId, tourId));
  }

  /** 測試用：建立 family + invite */
  seedFamilyForTest(input: {
    name: string;
    inviteCode: string;
    inviteMaxUses?: number;
  }): FamilyRecord {
    const id = randomUUID();
    const family: FamilyRecord = {
      id,
      name: input.name,
      inviteCode: input.inviteCode,
      inviteMaxUses: input.inviteMaxUses ?? 5,
      inviteUses: 0,
      createdAt: new Date().toISOString(),
    };
    this.families.set(id, family);
    this.familiesByInvite.set(family.inviteCode.toUpperCase(), family);
    return family;
  }

  /** 測試用：直接注入 api key */
  async insertApiKeyForTest(
    familyId: string,
    plaintext: string,
    label = "test",
  ): Promise<void> {
    const record: ApiKeyRecord = {
      id: randomUUID(),
      familyId,
      keyHash: hashApiKey(plaintext),
      label,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.apiKeys.set(record.keyHash, record);
  }
}
