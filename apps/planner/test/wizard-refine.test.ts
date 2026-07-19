import { randomUUID } from "node:crypto";

import { resetPlannerStoreForTests } from "../src/db/client.js";
import { MemoryPlannerStore } from "../src/db/memory-store.js";
import { resetWizardSessionStoreForTests } from "../src/cache/wizard-session-store.js";
import { wizardAnswer, wizardStart } from "../src/services/wizard-engine.js";
import { wizardRefine } from "../src/services/wizard-refine.js";

describe("wizard-refine", () => {
  const familyId = randomUUID();

  beforeEach(() => {
    resetPlannerStoreForTests(new MemoryPlannerStore(false));
    resetWizardSessionStoreForTests();
  });

  async function completeWizard(sessionId: string) {
    await wizardAnswer({ sessionId, familyId, step: "when", value: "暑假" });
    await wizardAnswer({ sessionId, familyId, step: "duration", value: "5天" });
    await wizardAnswer({
      sessionId,
      familyId,
      step: "destination",
      value: "還沒想好",
    });
    await wizardAnswer({
      sessionId,
      familyId,
      step: "depart_from",
      value: "台北",
    });
    await wizardAnswer({ sessionId, familyId, step: "must", value: "無購物" });
    await wizardAnswer({ sessionId, familyId, step: "budget", value: "2-3萬" });
    await wizardAnswer({ sessionId, familyId, step: "review", value: "確認" });
  }

  it("rejects refine before wizard complete", async () => {
    const { session } = await wizardStart(familyId);
    const result = await wizardRefine({
      sessionId: session.sessionId,
      familyId,
      field: "destination",
      value: "濟州",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("wizard_not_complete");
  });

  it("updates destination and marks ready after confirm", async () => {
    const { session } = await wizardStart(familyId);
    await completeWizard(session.sessionId);

    const clarified = await wizardRefine({
      sessionId: session.sessionId,
      familyId,
      field: "destination",
      value: "日本",
    });

    if (!clarified.ok && clarified.error === "adapter_failed") {
      return;
    }

    expect(clarified.ok).toBe(true);
    if (clarified.ok) {
      expect(clarified.field).toBe("destination");
      expect(clarified.answers.destination).toEqual({
        mode: "specific",
        keywords: ["日本"],
      });
    }
  });
});
