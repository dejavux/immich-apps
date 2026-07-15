import type { Express } from "express";

import { createPlannerApp } from "../src/index.js";
import { resetPlannerStoreForTests } from "../src/db/client.js";
import { MemoryPlannerStore } from "../src/db/memory-store.js";
import { resetWizardSessionStoreForTests } from "../src/cache/wizard-session-store.js";

async function jsonFetch(
  app: Express,
  path: string,
  init: RequestInit & { auth?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (init.auth) {
    headers.Authorization = `Bearer ${init.auth}`;
  }

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      headers,
    });
    const body = (await res.json()) as Record<string, unknown>;
    return { status: res.status, body };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe("wizard REST happy path", () => {
  let app: Express;
  let apiKey: string;
  const invite = "HAPPY-PATH-INVITE";

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    const store = new MemoryPlannerStore(false);
    store.seedFamilyForTest({
      name: "Happy Path",
      inviteCode: invite,
      inviteMaxUses: 5,
    });
    resetPlannerStoreForTests(store);
    resetWizardSessionStoreForTests();
    app = createPlannerApp();

    const redeemed = await jsonFetch(app, "/api/planner/v1/auth/redeem-invite", {
      method: "POST",
      body: JSON.stringify({ inviteCode: invite }),
    });
    apiKey = String(redeemed.body.apiKey);
  });

  it("completes six wizard steps", async () => {
    const start = await jsonFetch(app, "/api/planner/v1/wizard/sessions", {
      method: "POST",
      auth: apiKey,
    });
    expect(start.status).toBe(201);
    const sessionId = String(start.body.sessionId);

    const steps: Array<{ step: string; value: string }> = [
      { step: "when", value: "暑假" },
      { step: "duration", value: "5天" },
      { step: "depart_from", value: "台北" },
      { step: "must", value: "無購物" },
      { step: "budget", value: "2-3萬" },
      { step: "review", value: "確認" },
    ];

    for (const row of steps) {
      const answered = await jsonFetch(
        app,
        `/api/planner/v1/wizard/sessions/${sessionId}/answer`,
        {
          method: "POST",
          auth: apiKey,
          body: JSON.stringify(row),
        },
      );
      expect(answered.status).toBe(200);
    }

    const status = await jsonFetch(app, `/api/planner/v1/wizard/sessions/${sessionId}`, {
      auth: apiKey,
    });
    expect(status.body.readyForSearch).toBe(true);
    expect(status.body.step).toBe("review");
  });
});
