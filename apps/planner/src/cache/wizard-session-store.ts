import type { WizardSession } from "@family-memories/planner-schema";

import { env } from "../config/env.js";
import { getRedisClient } from "./redis.js";

const memorySessions = new Map<string, { session: WizardSession; expiresAt: number }>();

function sessionKey(sessionId: string): string {
  return `wizard:session:${sessionId}`;
}

function ttlSeconds(): number {
  return env.wizardSessionTtlHours * 3600;
}

export class WizardSessionStore {
  async get(sessionId: string): Promise<WizardSession | null> {
    const redis = await getRedisClient();
    if (redis) {
      const raw = await redis.get(sessionKey(sessionId));
      if (!raw) return null;
      return JSON.parse(raw) as WizardSession;
    }

    const row = memorySessions.get(sessionId);
    if (!row) return null;
    if (Date.now() > row.expiresAt) {
      memorySessions.delete(sessionId);
      return null;
    }
    return row.session;
  }

  async set(session: WizardSession): Promise<void> {
    const redis = await getRedisClient();
    const payload = JSON.stringify(session);
    if (redis) {
      await redis.set(sessionKey(session.sessionId), payload, { EX: ttlSeconds() });
      return;
    }
    memorySessions.set(session.sessionId, {
      session,
      expiresAt: Date.now() + ttlSeconds() * 1000,
    });
  }

  async delete(sessionId: string): Promise<void> {
    const redis = await getRedisClient();
    if (redis) {
      await redis.del(sessionKey(sessionId));
      return;
    }
    memorySessions.delete(sessionId);
  }
}

export function clearMemoryWizardSessionsForTests(): void {
  memorySessions.clear();
}

let store: WizardSessionStore | null = null;

export function getWizardSessionStore(): WizardSessionStore {
  if (!store) {
    store = new WizardSessionStore();
  }
  return store;
}

export function resetWizardSessionStoreForTests(): void {
  store = new WizardSessionStore();
  clearMemoryWizardSessionsForTests();
}
