import { env } from "../line-bot/config/env";

export function resolveWebAuthnRpId(): string {
  if (env.webauthnRpId) {
    return env.webauthnRpId;
  }
  try {
    return new URL(env.lineBotPublicUrl).hostname;
  } catch {
    return "immich-bot.3q.fi";
  }
}

export function resolveWebAuthnRpName(): string {
  return env.webauthnRpName;
}

export function expectedWebAuthnOrigins(): string[] {
  const out = new Set<string>();
  const push = (raw: string | undefined) => {
    const value = raw?.trim();
    if (!value) {
      return;
    }
    try {
      out.add(new URL(value).origin);
    } catch {
      if (value.startsWith("http")) {
        out.add(value.replace(/\/+$/, ""));
      }
    }
  };
  push(env.lineBotPublicUrl);
  push(env.immichWebUrl);
  if (out.size === 0) {
    push("http://127.0.0.1:3000");
  }
  return [...out];
}
