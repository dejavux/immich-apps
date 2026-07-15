import type { TourSummary } from "@family-memories/planner-schema";

export type FamilyRecord = {
  id: string;
  name: string;
  inviteCode: string;
  inviteMaxUses: number;
  inviteUses: number;
  createdAt: string;
};

export type ApiKeyRecord = {
  id: string;
  familyId: string;
  keyHash: string;
  label: string;
  revokedAt: string | null;
  createdAt: string;
};

export type UsageDailyRecord = {
  familyId: string;
  date: string;
  searchCount: number;
  extractCount: number;
};

export type ShortlistRecord = {
  familyId: string;
  tourId: string;
  summary: TourSummary;
  addedAt: string;
};

export type FamilyAuthContext = {
  family: FamilyRecord;
  apiKeyId: string;
  apiKeyLabel: string;
};

export interface PlannerStore {
  findFamilyByInviteCode(inviteCode: string): Promise<FamilyRecord | null>;
  findFamilyById(id: string): Promise<FamilyRecord | null>;
  redeemInvite(input: {
    inviteCode: string;
    label?: string;
  }): Promise<{ family: FamilyRecord; apiKey: string } | { error: "invalid_invite" | "invite_exhausted" }>;
  resolveApiKey(plaintextKey: string): Promise<FamilyAuthContext | null>;
  getUsageDaily(familyId: string, date: string): Promise<UsageDailyRecord>;
  incrementSearchCount(familyId: string, date: string): Promise<UsageDailyRecord>;
  incrementExtractCount(familyId: string, date: string): Promise<UsageDailyRecord>;
  listShortlist(familyId: string): Promise<ShortlistRecord[]>;
  addShortlist(input: {
    familyId: string;
    tourId: string;
    summary: ShortlistRecord["summary"];
  }): Promise<ShortlistRecord>;
  removeShortlist(familyId: string, tourId: string): Promise<boolean>;
  findShortlistItem(familyId: string, tourId: string): Promise<ShortlistRecord | null>;
}
