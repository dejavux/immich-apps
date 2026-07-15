import type { Express, Response } from "express";

import { env } from "../config/env.js";
import type { AuthenticatedPlannerRequest } from "../auth/middleware.js";
import { getPlannerStore } from "../db/client.js";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function registerFamilyRoutes(app: Express, apiPrefix: string): void {
  app.get(`${apiPrefix}/families/me`, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const auth = req.familyAuth;
    if (!auth) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }

    const usage = await getPlannerStore().getUsageDaily(auth.family.id, todayUtc());
    res.json({
      ok: true,
      family: {
        id: auth.family.id,
        name: auth.family.name,
        apiKeyLabel: auth.apiKeyLabel,
      },
      quota: {
        searchPerDay: env.quotaSearchPerDay,
        extractPerDay: env.quotaExtractPerDay,
        searchUsedToday: usage.searchCount,
        extractUsedToday: usage.extractCount,
      },
    });
  });
}
