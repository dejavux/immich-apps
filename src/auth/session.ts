import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuthRole } from "./roles";

export type AuthLevel = "liff" | "passkey";

export type AuthSessionPayload = {
  sub: string;
  role: AuthRole;
  authLevel: AuthLevel;
  exp: number;
  iat: number;
};

const LIFF_SESSION_TTL_SEC = 24 * 60 * 60;
const PASSKEY_SESSION_TTL_SEC = 8 * 60 * 60;

function sessionSecret(): string | null {
  const secret = (
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.LINE_CHANNEL_SECRET?.trim() ||
    ""
  );
  return secret.length > 0 ? secret : null;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function issueAuthSession(params: {
  lineUserId: string;
  role: AuthRole;
  authLevel: AuthLevel;
}): { sessionToken: string; expiresInSec: number } | null {
  const secret = sessionSecret();
  if (!secret) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const ttl =
    params.authLevel === "passkey"
      ? PASSKEY_SESSION_TTL_SEC
      : LIFF_SESSION_TTL_SEC;
  const payload: AuthSessionPayload = {
    sub: params.lineUserId,
    role: params.role,
    authLevel: params.authLevel,
    iat: now,
    exp: now + ttl,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encoded, secret);
  return {
    sessionToken: `${encoded}.${signature}`,
    expiresInSec: ttl,
  };
}

export function verifyAuthSession(
  token: string,
): { ok: true; session: AuthSessionPayload } | { ok: false; reason: string } {
  const secret = sessionSecret();
  if (!secret) {
    return { ok: false, reason: "session_not_configured" };
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false, reason: "invalid_token" };
  }
  const [encoded, signature] = parts;
  if (!encoded || !signature) {
    return { ok: false, reason: "invalid_token" };
  }
  const expected = signPayload(encoded, secret);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "invalid_signature" };
  }
  let payload: AuthSessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded)) as AuthSessionPayload;
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
  if (
    typeof payload.sub !== "string" ||
    typeof payload.exp !== "number" ||
    (payload.role !== "admin" && payload.role !== "user")
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  if (payload.authLevel !== "liff" && payload.authLevel !== "passkey") {
    return { ok: false, reason: "invalid_payload" };
  }
  return { ok: true, session: payload };
}

export function isAuthSessionConfigured(): boolean {
  return sessionSecret() !== null;
}
