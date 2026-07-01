import { issueAuthSession, verifyAuthSession } from "./session";

describe("auth session", () => {
  const prevSecret = process.env.AUTH_SESSION_SECRET;

  beforeAll(() => {
    process.env.AUTH_SESSION_SECRET = "test-session-secret";
  });

  afterAll(() => {
    if (prevSecret === undefined) {
      delete process.env.AUTH_SESSION_SECRET;
    } else {
      process.env.AUTH_SESSION_SECRET = prevSecret;
    }
  });

  it("issues and verifies liff session", () => {
    const issued = issueAuthSession({
      lineUserId: "Utest123",
      role: "user",
      authLevel: "liff",
    });
    expect(issued).not.toBeNull();
    const verified = verifyAuthSession(issued!.sessionToken);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.session.sub).toBe("Utest123");
      expect(verified.session.authLevel).toBe("liff");
    }
  });

  it("rejects tampered token", () => {
    const issued = issueAuthSession({
      lineUserId: "Utest123",
      role: "user",
      authLevel: "liff",
    });
    const verified = verifyAuthSession(`${issued!.sessionToken}x`);
    expect(verified.ok).toBe(false);
  });
});
