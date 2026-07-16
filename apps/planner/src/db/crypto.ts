import { createHash, randomBytes } from "node:crypto";

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateApiKey(): string {
  return `fmp_${randomBytes(24).toString("base64url")}`;
}

export function hashApiKeyForTests(plaintext: string): string {
  return hashApiKey(plaintext);
}
