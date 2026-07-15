import type { NextFunction, Response } from "express";
import { randomUUID } from "node:crypto";

import {
  requireFamilyApiKey,
  type AuthenticatedPlannerRequest,
} from "../src/auth/middleware.js";
import { resetPlannerStoreForTests } from "../src/db/client.js";
import { MemoryPlannerStore } from "../src/db/memory-store.js";

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown };
}

describe("requireFamilyApiKey", () => {
  beforeEach(() => {
    resetPlannerStoreForTests(new MemoryPlannerStore(false));
  });

  it("returns 401 without Bearer token", async () => {
    const req = { headers: {} } as AuthenticatedPlannerRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    await requireFamilyApiKey(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts valid api key", async () => {
    const store = new MemoryPlannerStore(false);
    const family = store.seedFamilyForTest({
      name: "Test",
      inviteCode: "TEST-INVITE-A1",
      inviteMaxUses: 1,
    });

    const apiKey = "fmp_test_key_123";
    await store.insertApiKeyForTest(family.id, apiKey);
    resetPlannerStoreForTests(store);

    const req = {
      headers: { authorization: `Bearer ${apiKey}` },
    } as AuthenticatedPlannerRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;
    await requireFamilyApiKey(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.familyAuth?.family.id).toBe(family.id);
  });
});
