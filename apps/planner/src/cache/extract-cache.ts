import { createHash } from "node:crypto";

import type { AgencyId, TourSummary } from "@family-memories/planner-schema";

import { env } from "../config/env.js";
import { getRedisClient } from "./redis.js";

export type ExtractCacheEntry = {
  cacheKey: string;
  agency: AgencyId;
  summary: TourSummary;
  extractedAt: string;
  expiresAt: string;
};

const memoryCache = new Map<string, ExtractCacheEntry>();

function cacheTtlMs(): number {
  return env.extractCacheTtlHours * 60 * 60 * 1000;
}

export function normalizeTourUrl(raw: string): URL {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  url.hash = "";
  return url;
}

export function extractCacheKey(url: URL): string {
  const normalized = `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}${url.search}`;
  return createHash("sha256").update(normalized).digest("hex");
}

function redisKey(cacheKey: string): string {
  return `extract:cache:${cacheKey}`;
}

function isExpired(entry: ExtractCacheEntry): boolean {
  return Date.parse(entry.expiresAt) <= Date.now();
}

export async function getExtractCache(cacheKey: string): Promise<ExtractCacheEntry | null> {
  const mem = memoryCache.get(cacheKey);
  if (mem) {
    if (isExpired(mem)) {
      memoryCache.delete(cacheKey);
    } else {
      return mem;
    }
  }

  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  const raw = await redis.get(redisKey(cacheKey));
  if (!raw) {
    return null;
  }

  try {
    const entry = JSON.parse(raw) as ExtractCacheEntry;
    if (isExpired(entry)) {
      await redis.del(redisKey(cacheKey));
      return null;
    }
    memoryCache.set(cacheKey, entry);
    return entry;
  } catch {
    await redis.del(redisKey(cacheKey));
    return null;
  }
}

export async function setExtractCache(input: {
  cacheKey: string;
  agency: AgencyId;
  summary: TourSummary;
}): Promise<ExtractCacheEntry> {
  const extractedAt = input.summary.extractedAt ?? new Date().toISOString();
  const entry: ExtractCacheEntry = {
    cacheKey: input.cacheKey,
    agency: input.agency,
    summary: { ...input.summary, extractedAt },
    extractedAt,
    expiresAt: new Date(Date.now() + cacheTtlMs()).toISOString(),
  };

  memoryCache.set(input.cacheKey, entry);

  const redis = await getRedisClient();
  if (redis) {
    const ttlSec = Math.max(60, Math.floor(cacheTtlMs() / 1000));
    await redis.set(redisKey(input.cacheKey), JSON.stringify(entry), { EX: ttlSec });
  }

  return entry;
}

export function resetExtractCacheForTests(): void {
  memoryCache.clear();
}
