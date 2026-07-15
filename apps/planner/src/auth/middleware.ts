import type { NextFunction, Request, Response } from "express";

import { getPlannerStore } from "../db/client.js";
import type { FamilyAuthContext } from "../db/types.js";

export type AuthenticatedPlannerRequest = Request & {
  familyAuth?: FamilyAuthContext;
};

function parseBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function requireFamilyApiKey(
  req: AuthenticatedPlannerRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ ok: false, error: "missing_api_key", message: "需要 Bearer api_key" });
    return;
  }

  const ctx = await getPlannerStore().resolveApiKey(token);
  if (!ctx) {
    res.status(401).json({ ok: false, error: "invalid_api_key", message: "api_key 無效或已撤銷" });
    return;
  }

  req.familyAuth = ctx;
  next();
}

export function parseBearerTokenForTests(header: string | undefined): string | null {
  return parseBearerToken(header);
}
