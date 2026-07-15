import type { Express, Response } from "express";
import type { TourSummary } from "@family-memories/planner-schema";

import type { AuthenticatedPlannerRequest } from "../auth/middleware.js";
import {
  shortlistAdd,
  shortlistList,
  shortlistRemove,
} from "../services/shortlist.js";

function paramId(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] ?? "" : raw;
}

export function registerShortlistRoutes(app: Express, apiPrefix: string): void {
  const base = `${apiPrefix}/shortlist`;

  app.get(base, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const familyId = req.familyAuth?.family.id;
    if (!familyId) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }

    const result = await shortlistList(familyId);
    res.json(result);
  });

  app.post(base, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const familyId = req.familyAuth?.family.id;
    if (!familyId) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }

    const body = req.body as {
      tourId?: string;
      url?: string;
      summary?: TourSummary;
    };

    const result = await shortlistAdd({
      familyId,
      tourId: body.tourId,
      url: body.url,
      summary: body.summary,
    });

    if (!result.ok) {
      const status =
        result.error === "quota_exceeded"
          ? 429
          : result.error === "not_supported"
            ? 422
            : result.error === "adapter_failed"
              ? 502
              : 400;
      res.status(status).json({ ok: false, error: result.error, message: result.message });
      return;
    }

    res.status(201).json({ ok: true, item: result.item });
  });

  app.delete(`${base}/:tourId`, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const familyId = req.familyAuth?.family.id;
    if (!familyId) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }

    const result = await shortlistRemove({
      familyId,
      tourId: decodeURIComponent(paramId(req.params.tourId)),
    });

    if (!result.ok) {
      res.status(404).json({ ok: false, error: result.error, message: result.message });
      return;
    }

    res.json({ ok: true, removed: result.removed });
  });
}
