import { getSharedRedisClient } from "./redis-client";

/** 與 passkey session TTL 對齊：Safari 驗證後，LINE 內建瀏覽器可同步解鎖狀態 */
export const PASSKEY_UNLOCK_GRANT_TTL_SEC = 8 * 60 * 60;

const GRANT_KEY_PREFIX = "immich:passkey:unlock-grant:";

const memoryGrants = new Map<string, number>();

function grantKey(lineUserId: string): string {
  return `${GRANT_KEY_PREFIX}${lineUserId}`;
}

export async function setPasskeyUnlockGrant(lineUserId: string): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + PASSKEY_UNLOCK_GRANT_TTL_SEC;
  const client = await getSharedRedisClient();
  if (client) {
    await client.setEx(grantKey(lineUserId), PASSKEY_UNLOCK_GRANT_TTL_SEC, "1");
    return;
  }
  memoryGrants.set(lineUserId, expiresAt);
}

export async function hasPasskeyUnlockGrant(lineUserId: string): Promise<boolean> {
  const client = await getSharedRedisClient();
  if (client) {
    const value = await client.get(grantKey(lineUserId));
    return value === "1";
  }
  const expiresAt = memoryGrants.get(lineUserId);
  if (!expiresAt) {
    return false;
  }
  if (expiresAt <= Math.floor(Date.now() / 1000)) {
    memoryGrants.delete(lineUserId);
    return false;
  }
  return true;
}

export async function clearPasskeyUnlockGrant(lineUserId: string): Promise<void> {
  const client = await getSharedRedisClient();
  if (client) {
    await client.del(grantKey(lineUserId));
  }
  memoryGrants.delete(lineUserId);
}
