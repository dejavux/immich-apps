import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { Router } from "express";

import { env } from "../line-bot/config/env";
import { verifyLineIdToken } from "./line-id-token";
import {
  requireAuthSession,
  requirePasskeySession,
  type AuthenticatedRequest,
} from "./middleware";
import { getPasskeyStore } from "./passkey-store";
import { resolveAuthRole } from "./roles";
import { issueAuthSession, isAuthSessionConfigured } from "./session";
import {
  setAuthenticationChallenge,
  setRegistrationChallenge,
  takeAuthenticationChallenge,
  takeRegistrationChallenge,
} from "./webauthn-challenges";
import {
  expectedWebAuthnOrigins,
  resolveWebAuthnRpId,
  resolveWebAuthnRpName,
} from "./webauthn-config";

export const authRoutes = Router();

authRoutes.post("/session", async (req, res) => {
  if (!isAuthSessionConfigured()) {
    res.status(503).json({ ok: false, error: "session_not_configured" });
    return;
  }
  const idToken =
    typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  if (!idToken) {
    res.status(400).json({ ok: false, error: "idToken is required" });
    return;
  }
  const verified = await verifyLineIdToken(idToken);
  if (!verified.ok) {
    res
      .status(401)
      .json({ ok: false, error: "invalid_id_token", reason: verified.reason });
    return;
  }
  const lineUserId = verified.user.lineUserId;
  const role = resolveAuthRole(lineUserId);
  const issued = issueAuthSession({
    lineUserId,
    role,
    authLevel: "liff",
  });
  if (!issued) {
    res.status(503).json({ ok: false, error: "session_not_configured" });
    return;
  }
  res.json({
    ok: true,
    sessionToken: issued.sessionToken,
    expiresInSec: issued.expiresInSec,
    role,
    authLevel: "liff",
  });
});

authRoutes.get("/me", requireAuthSession, async (req: AuthenticatedRequest, res) => {
  const session = req.authSession!;
  const passkeyStore = await getPasskeyStore();
  const passkeys = await passkeyStore.listByLineUser(session.sub);
  res.json({
    ok: true,
    lineUserId: session.sub,
    role: session.role,
    authLevel: session.authLevel,
    passkeyCount: passkeys.length,
    requiresUnlock: passkeys.length > 0 && session.authLevel !== "passkey",
    immichWebUrl: env.immichWebUrl,
  });
});

authRoutes.get("/settings", requireAuthSession, async (req: AuthenticatedRequest, res) => {
  const session = req.authSession!;
  const passkeyStore = await getPasskeyStore();
  const passkeys = await passkeyStore.listByLineUser(session.sub);
  if (passkeys.length > 0 && session.authLevel !== "passkey") {
    res.status(403).json({ ok: false, error: "passkey_gate_required" });
    return;
  }
  res.json({
    ok: true,
    immichWebUrl: env.immichWebUrl,
    passkeys: passkeys.map((cred) => ({
      id: cred.id,
      transports: cred.transports ?? [],
    })),
  });
});

authRoutes.get(
  "/admin/settings",
  requireAuthSession,
  async (req: AuthenticatedRequest, res) => {
    const session = req.authSession!;
    if (session.role !== "admin") {
      res.status(403).json({ ok: false, error: "admin_required" });
      return;
    }
    const passkeyStore = await getPasskeyStore();
    const passkeys = await passkeyStore.listByLineUser(session.sub);
    if (passkeys.length > 0 && session.authLevel !== "passkey") {
      res.status(403).json({ ok: false, error: "passkey_gate_required" });
      return;
    }
    res.json({
      ok: true,
      admin: {
        immichBaseUrl: env.immichBaseUrl,
        immichWebUrl: env.immichWebUrl,
        immichLineAlbumName: env.immichLineAlbumName,
        photoSearchEnabled: env.photoSearchEnabled,
        redisConfigured: Boolean(env.redisUrl),
        liffConfigured: Boolean(env.liffId),
      },
    });
  },
);

const webauthnRoutes = Router();

webauthnRoutes.get(
  "/credentials",
  requireAuthSession,
  async (req: AuthenticatedRequest, res) => {
    const session = req.authSession!;
    const store = await getPasskeyStore();
    const creds = await store.listByLineUser(session.sub);
    res.json({
      ok: true,
      count: creds.length,
      credentials: creds.map((cred) => ({
        id: cred.id,
        transports: cred.transports ?? [],
      })),
    });
  },
);

webauthnRoutes.post(
  "/register/options",
  requireAuthSession,
  async (req: AuthenticatedRequest, res) => {
    const session = req.authSession!;
    const store = await getPasskeyStore();
    const existing = await store.listByLineUser(session.sub);
    if (existing.length > 0 && session.authLevel !== "passkey") {
      res.status(403).json({ ok: false, error: "passkey_gate_required" });
      return;
    }
    const rpID = resolveWebAuthnRpId();
    const options = await generateRegistrationOptions({
      rpName: resolveWebAuthnRpName(),
      rpID,
      userID: isoUint8Array.fromUTF8String(session.sub),
      userName: `line:${session.sub}`,
      userDisplayName: `Immich ${session.sub.slice(0, 8)}`,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      excludeCredentials: existing.map((cred) => ({
        id: cred.id,
        type: "public-key" as const,
        transports: cred.transports,
      })),
      timeout: 60_000,
    });
    setRegistrationChallenge(session.sub, options.challenge);
    res.json({ ok: true, options });
  },
);

webauthnRoutes.post(
  "/register/verify",
  requireAuthSession,
  async (req: AuthenticatedRequest, res) => {
    const session = req.authSession!;
    const passkeyStore = await getPasskeyStore();
    const existing = await passkeyStore.listByLineUser(session.sub);
    if (existing.length > 0 && session.authLevel !== "passkey") {
      res.status(403).json({ ok: false, error: "passkey_gate_required" });
      return;
    }
    const response = req.body?.response as RegistrationResponseJSON | undefined;
    const challenge = takeRegistrationChallenge(session.sub);
    if (!response || !challenge) {
      res.status(400).json({ ok: false, error: "invalid_or_expired_challenge" });
      return;
    }
    try {
      const verified = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: expectedWebAuthnOrigins(),
        expectedRPID: resolveWebAuthnRpId(),
        requireUserVerification: true,
      });
      if (!verified.verified || !verified.registrationInfo) {
        res.status(400).json({ ok: false, error: "verification_failed" });
        return;
      }
      const cred = verified.registrationInfo.credential;
      const store = await getPasskeyStore();
      await store.save({
        lineUserId: session.sub,
        credentialId: cred.id,
        publicKey: cred.publicKey,
        counter: cred.counter,
        transports: cred.transports,
      });
      res.json({ ok: true, verified: true, credentialId: cred.id });
    } catch (error) {
      console.error("[auth/webauthn] register/verify", error);
      res.status(400).json({ ok: false, error: "verification_failed" });
    }
  },
);

webauthnRoutes.post(
  "/assert/options",
  requireAuthSession,
  async (req: AuthenticatedRequest, res) => {
    const session = req.authSession!;
    const store = await getPasskeyStore();
    const creds = await store.listByLineUser(session.sub);
    if (creds.length === 0) {
      res.status(400).json({ ok: false, error: "no_credentials" });
      return;
    }
    const options = await generateAuthenticationOptions({
      rpID: resolveWebAuthnRpId(),
      allowCredentials: creds.map((cred) => ({
        id: cred.id,
        type: "public-key" as const,
        transports: cred.transports,
      })),
      userVerification: "required",
      timeout: 60_000,
    });
    setAuthenticationChallenge(session.sub, options.challenge);
    res.json({ ok: true, options });
  },
);

async function verifyPasskeyAssertion(
  lineUserId: string,
  response: AuthenticationResponseJSON,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const challenge = takeAuthenticationChallenge(lineUserId);
  if (!challenge) {
    return { ok: false, error: "invalid_or_expired_challenge" };
  }
  const store = await getPasskeyStore();
  const dbCred = await store.getByCredentialId(response.id);
  if (!dbCred || dbCred.lineUserId !== lineUserId) {
    return { ok: false, error: "unknown_credential" };
  }
  const verified = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: expectedWebAuthnOrigins(),
    expectedRPID: resolveWebAuthnRpId(),
    credential: {
      id: dbCred.id,
      publicKey: dbCred.publicKey,
      counter: dbCred.counter,
      transports: dbCred.transports,
    },
    requireUserVerification: true,
  });
  if (!verified.verified) {
    return { ok: false, error: "verification_failed" };
  }
  await store.updateCounter(
    verified.authenticationInfo.credentialID,
    verified.authenticationInfo.newCounter,
  );
  return { ok: true };
}

webauthnRoutes.post(
  "/session/upgrade",
  requireAuthSession,
  async (req: AuthenticatedRequest, res) => {
    const session = req.authSession!;
    const response = req.body?.response as AuthenticationResponseJSON | undefined;
    if (!response) {
      res.status(400).json({ ok: false, error: "missing_response" });
      return;
    }
    try {
      const verified = await verifyPasskeyAssertion(session.sub, response);
      if (!verified.ok) {
        res.status(400).json({ ok: false, error: verified.error });
        return;
      }
      const issued = issueAuthSession({
        lineUserId: session.sub,
        role: session.role,
        authLevel: "passkey",
      });
      if (!issued) {
        res.status(503).json({ ok: false, error: "session_not_configured" });
        return;
      }
      res.json({
        ok: true,
        verified: true,
        authLevel: "passkey",
        sessionToken: issued.sessionToken,
        expiresInSec: issued.expiresInSec,
      });
    } catch (error) {
      console.error("[auth/webauthn] session/upgrade", error);
      res.status(400).json({ ok: false, error: "verification_failed" });
    }
  },
);

webauthnRoutes.post(
  "/credentials/revoke",
  requirePasskeySession,
  async (req: AuthenticatedRequest, res) => {
    const session = req.authSession!;
    const credentialId =
      typeof req.body?.credentialId === "string"
        ? req.body.credentialId.trim()
        : "";
    if (!credentialId) {
      res.status(400).json({ ok: false, error: "missing_credential_id" });
      return;
    }
    const store = await getPasskeyStore();
    const revoked = await store.revoke(session.sub, credentialId);
    if (!revoked) {
      res.status(404).json({ ok: false, error: "credential_not_found" });
      return;
    }
    res.json({ ok: true, revoked: true });
  },
);

authRoutes.use("/webauthn", webauthnRoutes);
