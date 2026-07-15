import { createHash } from "node:crypto";

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function hashApiKeyForTests(plaintext: string): string {
  return hashApiKey(plaintext);
}
