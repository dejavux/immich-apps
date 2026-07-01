jest.mock("./redis-client", () => ({
  getSharedRedisClient: jest.fn().mockResolvedValue(null),
}));

import {
  clearPasskeyUnlockGrant,
  hasPasskeyUnlockGrant,
  setPasskeyUnlockGrant,
} from "./passkey-unlock-grant";

describe("passkey unlock grant", () => {
  const userId = "Ugrant-test";

  beforeEach(async () => {
    await clearPasskeyUnlockGrant(userId);
  });

  it("sets and checks grant", async () => {
    expect(await hasPasskeyUnlockGrant(userId)).toBe(false);
    await setPasskeyUnlockGrant(userId);
    expect(await hasPasskeyUnlockGrant(userId)).toBe(true);
  });

  it("clears grant", async () => {
    await setPasskeyUnlockGrant(userId);
    await clearPasskeyUnlockGrant(userId);
    expect(await hasPasskeyUnlockGrant(userId)).toBe(false);
  });
});
