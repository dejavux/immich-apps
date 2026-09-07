import { env } from "../line-bot/config/env";

/** Passkey / WebAuthn gate (LIFF Safari flow). Set PASSKEY_ENABLED=true to re-enable. */
export function isPasskeyEnabled(): boolean {
  return env.passkeyEnabled;
}
