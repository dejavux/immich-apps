import { randomUUID } from "node:crypto";

import { resetPlannerStoreForTests } from "../src/db/client.js";
import { MemoryPlannerStore } from "../src/db/memory-store.js";
import { resetWizardSessionStoreForTests } from "../src/cache/wizard-session-store.js";
import {
  isSessionReadyForSearch,
  wizardAnswer,
  wizardBack,
  wizardStart,
} from "../src/services/wizard-engine.js";

describe("wizard-engine FSM", () => {
  const familyId = randomUUID();

  beforeEach(() => {
    resetPlannerStoreForTests(new MemoryPlannerStore(false));
    resetWizardSessionStoreForTests();
  });

  async function fillThroughBudget(sessionId: string) {
    await wizardAnswer({ sessionId, familyId, step: "when", value: "暑假" });
    await wizardAnswer({ sessionId, familyId, step: "duration", value: "5天" });
    await wizardAnswer({ sessionId, familyId, step: "depart_from", value: "台北" });
    await wizardAnswer({ sessionId, familyId, step: "must", value: "無購物" });
    return wizardAnswer({ sessionId, familyId, step: "budget", value: "2-3萬" });
  }

  it("advances steps in order", async () => {
    const { session } = await wizardStart(familyId);
    expect(session.step).toBe("when");

    const r1 = await wizardAnswer({
      sessionId: session.sessionId,
      familyId,
      step: "when",
      value: "7-8月",
    });
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.session.step).toBe("duration");
  });

  it("blocks search before review confirm", async () => {
    const { session } = await wizardStart(familyId);
    await fillThroughBudget(session.sessionId);
    const status = await wizardAnswer({
      sessionId: session.sessionId,
      familyId,
      step: "review",
      value: "再看看",
    });
    expect(status.ok).toBe(false);
    if (!status.ok) expect(status.error).toBe("need_clarification");
  });

  it("allows search after review confirm", async () => {
    const { session } = await wizardStart(familyId);
    await fillThroughBudget(session.sessionId);
    const confirmed = await wizardAnswer({
      sessionId: session.sessionId,
      familyId,
      step: "review",
      value: "確認",
    });
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(isSessionReadyForSearch(confirmed.session)).toBe(true);
    }
  });

  it("wizard_back goes to previous step", async () => {
    const { session } = await wizardStart(familyId);
    await wizardAnswer({ sessionId: session.sessionId, familyId, step: "when", value: "暑假" });
    const back = await wizardBack({ sessionId: session.sessionId, familyId });
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.session.step).toBe("when");
  });
});
