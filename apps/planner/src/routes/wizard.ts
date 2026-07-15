import type { Express, Response } from "express";

import type { WizardStep } from "@family-memories/planner-schema";

import type { AuthenticatedPlannerRequest } from "../auth/middleware.js";
import {
  wizardAnswer,
  wizardBack,
  wizardStart,
  wizardStatus,
  promptForStep,
} from "../services/wizard-engine.js";
import { wizardSearch } from "../services/wizard-search.js";

function paramId(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] ?? "" : raw;
}

function sessionResponse(session: Awaited<ReturnType<typeof wizardStatus>>) {
  if (!session) return null;
  const prompt = promptForStep(session.step, session.answers);
  return {
    ok: true,
    sessionId: session.sessionId,
    step: session.step,
    answers: session.answers,
    clarification: session.clarification,
    readyForSearch: session.readyForSearch ?? false,
    tourType: session.tourType,
    resultTourIds: session.resultTourIds ?? [],
    prompt: prompt.prompt,
  };
}

export function registerWizardRoutes(app: Express, apiPrefix: string): void {
  const base = `${apiPrefix}/wizard/sessions`;

  app.post(base, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const familyId = req.familyAuth?.family.id;
    if (!familyId) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }
    const { session, prompt } = await wizardStart(familyId);
    res.status(201).json({
      ok: true,
      sessionId: session.sessionId,
      step: session.step,
      prompt: prompt.prompt,
      tourType: session.tourType,
    });
  });

  app.get(`${base}/:id`, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const familyId = req.familyAuth?.family.id;
    const session = await wizardStatus(paramId(req.params.id));
    if (!session || session.familyId !== familyId) {
      res.status(404).json({ ok: false, error: "session_not_found", message: "找不到 session" });
      return;
    }
    res.json(sessionResponse(session));
  });

  app.post(`${base}/:id/answer`, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const familyId = req.familyAuth?.family.id;
    if (!familyId) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }
    const body = req.body as { step?: WizardStep; value?: string };
    if (!body.step || body.value === undefined) {
      res.status(400).json({ ok: false, error: "invalid_request", message: "需要 step 與 value" });
      return;
    }

    const result = await wizardAnswer({
      sessionId: paramId(req.params.id),
      familyId,
      step: body.step,
      value: String(body.value),
    });

    if (!result.ok) {
      const status =
        result.error === "session_not_found"
          ? 404
          : result.error === "invalid_step"
            ? 409
            : 422;
      res.status(status).json({
        ok: false,
        error: result.error,
        message: result.message,
        session: "session" in result ? sessionResponse(result.session) : undefined,
      });
      return;
    }

    res.json({
      ok: true,
      session: sessionResponse(result.session),
      prompt: result.prompt?.prompt,
    });
  });

  app.post(`${base}/:id/back`, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const familyId = req.familyAuth?.family.id;
    if (!familyId) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }

    const result = await wizardBack({ sessionId: paramId(req.params.id), familyId });
    if (!result.ok) {
      const status = result.error === "session_not_found" ? 404 : 409;
      res.status(status).json({ ok: false, error: result.error, message: result.message });
      return;
    }

    res.json({
      ok: true,
      session: sessionResponse(result.session),
      prompt: result.prompt?.prompt,
    });
  });

  app.post(`${base}/:id/search`, async (req: AuthenticatedPlannerRequest, res: Response) => {
    const familyId = req.familyAuth?.family.id;
    if (!familyId) {
      res.status(401).json({ ok: false, error: "missing_api_key" });
      return;
    }

    const result = await wizardSearch({ sessionId: paramId(req.params.id), familyId });
    if (!result.ok) {
      const status =
        result.error === "session_not_found"
          ? 404
          : result.error === "quota_exceeded"
            ? 429
            : result.error === "not_ready"
              ? 409
              : 502;
      res.status(status).json({ ok: false, error: result.error, message: result.message });
      return;
    }

    res.json({
      ok: true,
      sessionId: result.sessionId,
      count: result.tours.length,
      tours: result.tours,
    });
  });
}
