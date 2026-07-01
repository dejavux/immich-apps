import type { AuthLevel } from "./session";
import { hasPasskeyUnlockGrant } from "./passkey-unlock-grant";
import { getPasskeyStore } from "./passkey-store";

/** 已註冊 Passkey 且近期於 Safari 驗證過 → 可發 passkey session（含 LINE 內建瀏覽器） */
export async function resolveAuthLevelForLineUser(
  lineUserId: string,
): Promise<AuthLevel> {
  const passkeyStore = await getPasskeyStore();
  const passkeys = await passkeyStore.listByLineUser(lineUserId);
  if (passkeys.length === 0) {
    return "liff";
  }
  const granted = await hasPasskeyUnlockGrant(lineUserId);
  return granted ? "passkey" : "liff";
}
