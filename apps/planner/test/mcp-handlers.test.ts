import { resetPlannerStoreForTests } from "../src/db/client.js";
import { MemoryPlannerStore } from "../src/db/memory-store.js";
import { resetWizardSessionStoreForTests } from "../src/cache/wizard-session-store.js";
import { handleWizardStart, handleWizardStatus } from "../src/mcp/handlers.js";

describe("MCP handlers", () => {
  let familyId: string;

  beforeEach(() => {
    resetWizardSessionStoreForTests();
    const store = new MemoryPlannerStore(false);
    familyId = store.seedFamilyForTest({
      name: "MCP Test",
      inviteCode: "MCP-TEST-INVITE",
      inviteMaxUses: 3,
    }).id;
    resetPlannerStoreForTests(store);
  });

  it("wizard_start returns session and prompt", async () => {
    const result = await handleWizardStart(familyId);
    expect(result.ok).toBe(true);
    expect(result.sessionId).toBeTruthy();
    expect(result.step).toBe("when");
    expect(result.prompt).toContain("出發");
  });

  it("wizard_status returns session payload", async () => {
    const started = await handleWizardStart(familyId);
    const status = await handleWizardStatus(familyId, started.sessionId);
    expect(status).toMatchObject({
      ok: true,
      sessionId: started.sessionId,
      step: "when",
    });
  });
});
