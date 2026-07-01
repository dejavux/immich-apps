import { env } from "../line-bot/config/env";

type LineIdTokenPayload = {
  sub?: string;
  aud?: string | string[];
  exp?: number;
};

export type VerifiedLineUser = {
  lineUserId: string;
};

export type IdTokenVerifyFailure =
  | "disabled"
  | "http_error"
  | "missing_sub"
  | "aud_mismatch"
  | "expired";

export function resolveLineLoginChannelId(): string {
  if (env.lineLoginChannelId !== "") {
    return env.lineLoginChannelId;
  }
  const liffPrefix = env.liffId?.split("-")[0]?.trim();
  return liffPrefix ?? "";
}

export function isIdTokenVerificationEnabled(): boolean {
  return resolveLineLoginChannelId() !== "";
}

function audienceMatches(payload: LineIdTokenPayload, clientId: string): boolean {
  const aud = payload.aud;
  if (typeof aud === "string") {
    return aud === clientId;
  }
  if (Array.isArray(aud)) {
    return aud.includes(clientId);
  }
  return false;
}

function isExpired(
  payload: LineIdTokenPayload,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  return typeof payload.exp === "number" && payload.exp <= nowSec;
}

export async function verifyLineIdToken(
  idToken: string,
): Promise<
  | { ok: true; user: VerifiedLineUser }
  | { ok: false; reason: IdTokenVerifyFailure; detail?: string }
> {
  const clientId = resolveLineLoginChannelId();
  if (clientId === "") {
    return { ok: false, reason: "disabled" };
  }

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: clientId,
  });

  let response: Response;
  try {
    response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network error";
    return { ok: false, reason: "http_error", detail };
  }

  if (!response.ok) {
    return { ok: false, reason: "http_error", detail: `${response.status}` };
  }

  const payload = (await response.json()) as LineIdTokenPayload;
  if (typeof payload.sub !== "string" || payload.sub === "") {
    return { ok: false, reason: "missing_sub" };
  }

  if (!audienceMatches(payload, clientId)) {
    return { ok: false, reason: "aud_mismatch" };
  }

  if (isExpired(payload)) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, user: { lineUserId: payload.sub } };
}
