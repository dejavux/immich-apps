import type { Express, Response } from "express";
import type { TourSummary } from "@family-memories/planner-schema";

import type { AuthenticatedPlannerRequest } from "../auth/middleware.js";
import { compareTours } from "../services/tour-compare.js";
import { extractTour } from "../services/tour-extract.js";

export function registerTourRoutes(app: Express, apiPrefix: string): void {
  const base = `${apiPrefix}/tours`;

  app.post(`${base}/extract`, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const familyId = req.familyAuth?.family.id;
    if (!familyId) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }

    const body = req.body as { url?: string; skipCache?: boolean };
    if (!body.url?.trim()) {
      res.status(400).json({ ok: false, error: "invalid_request", message: "需要 url" });
      return;
    }

    const result = await extractTour({
      familyId,
      url: body.url,
      skipCache: body.skipCache,
    });

    if (!result.ok) {
      const status =
        result.error === "quota_exceeded"
          ? 429
          : result.error === "not_supported"
            ? 422
            : result.error === "invalid_url"
              ? 400
              : 502;
      res.status(status).json({ ok: false, error: result.error, message: result.message });
      return;
    }

    res.json({
      ok: true,
      cached: result.cached,
      extractedAt: result.extractedAt,
      summary: result.summary,
    });
  });

  app.post(`${base}/compare`, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const familyId = req.familyAuth?.family.id;
    if (!familyId) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }

    const body = req.body as { tourIds?: string[]; tours?: TourSummary[] };
    const result = await compareTours({
      familyId,
      tourIds: body.tourIds,
      tours: body.tours,
    });

    if (!result.ok) {
      const status = result.error === "not_found" ? 404 : 400;
      res.status(status).json({ ok: false, error: result.error, message: result.message });
      return;
    }

    res.json({
      ok: true,
      count: result.count,
      tours: result.tours,
      tableMarkdown: result.tableMarkdown,
    });
  });
}
