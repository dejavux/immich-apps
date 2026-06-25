import type { ImmichPersonSummary } from "../../shared/types/immich";
import type { PhotoSearchPlan } from "../../shared/types/photo-search";

export interface SearchSessionState {
  plan: Partial<PhotoSearchPlan>;
  /** Person candidates when disambiguation is needed */
  personCandidates?: ImmichPersonSummary[];
  /** Plan awaiting user confirmation before search executes */
  pendingPlan?: Partial<PhotoSearchPlan>;
  awaitingConfirmation?: boolean;
  /** Last plan that returned zero results — drives empty-result quick replies */
  lastFailedPlan?: Partial<PhotoSearchPlan>;
  updatedAt: number;
}

export class SearchSessionStore {
  private readonly sessions = new Map<string, SearchSessionState>();

  constructor(private readonly ttlMs: number) {}

  get(userId: string): SearchSessionState | undefined {
    const session = this.sessions.get(userId);
    if (!session) {
      return undefined;
    }
    if (Date.now() - session.updatedAt > this.ttlMs) {
      this.sessions.delete(userId);
      return undefined;
    }
    return session;
  }

  save(userId: string, state: Omit<SearchSessionState, "updatedAt">): void {
    this.sessions.set(userId, { ...state, updatedAt: Date.now() });
  }

  clear(userId: string): void {
    this.sessions.delete(userId);
  }

  /** @internal test helper */
  resetForTest(): void {
    this.sessions.clear();
  }
}
