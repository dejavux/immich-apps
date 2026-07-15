import { getPlannerStore } from "../db/client.js";

export async function redeemInviteCode(input: {
  inviteCode: string;
  label?: string;
}): Promise<
  | { ok: true; familyId: string; familyName: string; apiKey: string }
  | { ok: false; error: "invalid_invite" | "invite_exhausted"; message: string }
> {
  const result = await getPlannerStore().redeemInvite(input);
  if ("error" in result) {
    const message =
      result.error === "invalid_invite"
        ? "邀請碼無效"
        : "邀請碼已達兌換上限";
    return { ok: false, error: result.error, message };
  }
  return {
    ok: true,
    familyId: result.family.id,
    familyName: result.family.name,
    apiKey: result.apiKey,
  };
}
