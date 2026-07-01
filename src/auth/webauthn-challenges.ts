const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type PendingChallenge = { challenge: string; expires: number };

const registrationChallenges = new Map<string, PendingChallenge>();
const authenticationChallenges = new Map<string, PendingChallenge>();

function pruneMap(map: Map<string, PendingChallenge>): void {
  const now = Date.now();
  for (const [key, value] of map) {
    if (value.expires < now) {
      map.delete(key);
    }
  }
}

export function setRegistrationChallenge(lineUserId: string, challenge: string): void {
  pruneMap(registrationChallenges);
  registrationChallenges.set(lineUserId, {
    challenge,
    expires: Date.now() + CHALLENGE_TTL_MS,
  });
}

export function takeRegistrationChallenge(lineUserId: string): string | null {
  pruneMap(registrationChallenges);
  const pending = registrationChallenges.get(lineUserId);
  if (!pending || pending.expires < Date.now()) {
    registrationChallenges.delete(lineUserId);
    return null;
  }
  registrationChallenges.delete(lineUserId);
  return pending.challenge;
}

export function setAuthenticationChallenge(lineUserId: string, challenge: string): void {
  pruneMap(authenticationChallenges);
  authenticationChallenges.set(lineUserId, {
    challenge,
    expires: Date.now() + CHALLENGE_TTL_MS,
  });
}

export function takeAuthenticationChallenge(lineUserId: string): string | null {
  pruneMap(authenticationChallenges);
  const pending = authenticationChallenges.get(lineUserId);
  if (!pending || pending.expires < Date.now()) {
    authenticationChallenges.delete(lineUserId);
    return null;
  }
  authenticationChallenges.delete(lineUserId);
  return pending.challenge;
}
