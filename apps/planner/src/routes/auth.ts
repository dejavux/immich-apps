import type { Express, Request, Response } from "express";

import { redeemInviteCode } from "../auth/family-admin.js";

export function registerAuthRoutes(app: Express, apiPrefix: string): void {
  app.post(`${apiPrefix}/auth/redeem-invite`, async (req: Request, res: Response) => {
    const body = req.body as { inviteCode?: string; label?: string };
    if (!body.inviteCode?.trim()) {
      res.status(400).json({ ok: false, error: "invalid_request", message: "需要 inviteCode" });
      return;
    }

    const result = await redeemInviteCode({
      inviteCode: body.inviteCode,
      label: body.label,
    });

    if (!result.ok) {
      res.status(result.error === "invalid_invite" ? 403 : 403).json(result);
      return;
    }

    res.status(201).json({
      ok: true,
      familyId: result.familyId,
      familyName: result.familyName,
      apiKey: result.apiKey,
    });
  });
}
