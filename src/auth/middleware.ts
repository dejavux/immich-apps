import type { NextFunction, Request, Response } from "express";

import type { AuthSessionPayload } from "./session";
import { verifyAuthSession } from "./session";

export type AuthenticatedRequest = Request & {
  authSession?: AuthSessionPayload;
};

function parseBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function requireAuthSession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ ok: false, error: "missing_session" });
    return;
  }
  const verified = verifyAuthSession(token);
  if (!verified.ok) {
    res.status(401).json({ ok: false, error: verified.reason });
    return;
  }
  req.authSession = verified.session;
  next();
}

export function requirePasskeySession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  requireAuthSession(req, res, () => {
    if (req.authSession?.authLevel !== "passkey") {
      res.status(403).json({ ok: false, error: "passkey_session_required" });
      return;
    }
    next();
  });
}
