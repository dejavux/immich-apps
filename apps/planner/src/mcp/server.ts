// MCP SDK + Zod 型別推斷在 strict tsc 下易 OOM；執行期由 SDK 驗證。
// @ts-nocheck
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v3";

import { env } from "../config/env.js";
import { WIZARD_STEP_ORDER } from "@family-memories/planner-schema";
import type { TourSummary, WizardStep } from "@family-memories/planner-schema";
import {
  handleCompareTours,
  handleExtractTour,
  handleShortlistAdd,
  handleShortlistList,
  handleShortlistRemove,
  handleWizardAnswer,
  handleWizardBack,
  handleWizardRefine,
  handleWizardSearch,
  handleWizardStart,
  handleWizardStatus,
  jsonToolText,
} from "./handlers.js";

const wizardStepSchema = z.enum(
  WIZARD_STEP_ORDER as [WizardStep, ...WizardStep[]],
);

function toolText(payload: unknown) {
  return { content: [jsonToolText(payload)] };
}

export function createPlannerMcpServer(familyId: string): McpServer {
  const server = new McpServer(
    {
      name: env.serviceName,
      version: "0.1.0",
    },
    { capabilities: { logging: {} } },
  );

  server.tool(
    "wizard_start",
    "建立 wizard session 並回傳第一步 prompt",
    async () => toolText(await handleWizardStart(familyId)),
  );

  server.tool(
    "wizard_status",
    "查詢 session 目前步驟與已填答案",
    { sessionId: z.string().describe("Wizard session ID") },
    async ({ sessionId }) =>
      toolText(await handleWizardStatus(familyId, sessionId)),
  );

  server.tool(
    "wizard_answer",
    "回答目前步驟並推進狀態機",
    {
      sessionId: z.string().describe("Wizard session ID"),
      step: wizardStepSchema.describe("目前步驟"),
      value: z.string().describe("使用者回答"),
    },
    async ({ sessionId, step, value }) =>
      toolText(await handleWizardAnswer(familyId, { sessionId, step, value })),
  );

  server.tool(
    "wizard_back",
    "回上一步",
    { sessionId: z.string().describe("Wizard session ID") },
    async ({ sessionId }) =>
      toolText(await handleWizardBack(familyId, sessionId)),
  );

  server.tool(
    "wizard_search",
    "review 確認後搜尋雄獅跟團",
    { sessionId: z.string().describe("Wizard session ID") },
    async ({ sessionId }) =>
      toolText(await handleWizardSearch(familyId, sessionId)),
  );

  const refineFieldSchema = z.enum([
    "destination",
    "when",
    "duration",
    "depart_from",
    "must",
    "budget",
  ]);

  server.tool(
    "wizard_refine",
    "搜尋後只改單一欄位並重新搜尋（保留其他條件）",
    {
      sessionId: z.string().describe("Wizard session ID"),
      field: refineFieldSchema.describe("要修改的欄位"),
      value: z.string().describe("新值（自然語言，與 wizard_answer 相同解析）"),
    },
    async ({ sessionId, field, value }) =>
      toolText(await handleWizardRefine(familyId, { sessionId, field, value })),
  );

  server.tool(
    "extract_tour",
    "從旅行社 URL 深抽完整 TourSummary",
    {
      url: z.string().describe("旅行社行程 URL"),
      skipCache: z.boolean().optional().describe("略過快取"),
    },
    async ({ url, skipCache }) =>
      toolText(await handleExtractTour(familyId, { url, skipCache })),
  );

  server.tool(
    "compare_tours",
    "2–N 筆行程對照（shortlist id 或 inline summaries）",
    {
      tourIds: z
        .array(z.string())
        .optional()
        .describe("shortlist 或搜尋結果 tour id"),
      tours: z.array(z.unknown()).optional().describe("inline TourSummary[]"),
    },
    async ({ tourIds, tours }) =>
      toolText(
        await handleCompareTours(familyId, {
          tourIds,
          tours: tours as TourSummary[] | undefined,
        }),
      ),
  );

  server.tool(
    "shortlist_add",
    "加入家庭候選行程（url 或 summary）",
    {
      tourId: z.string().optional().describe("穩定 tour id"),
      url: z.string().optional().describe("旅行社 URL（會自動 extract）"),
      summary: z.unknown().optional().describe("TourSummary 物件"),
    },
    async ({ tourId, url, summary }) =>
      toolText(
        await handleShortlistAdd(familyId, {
          tourId,
          url,
          summary: summary as TourSummary | undefined,
        }),
      ),
  );

  server.tool("shortlist_list", "列出家庭 shortlist", async () =>
    toolText(await handleShortlistList(familyId)),
  );

  server.tool(
    "shortlist_remove",
    "從 shortlist 移除指定 tourId",
    { tourId: z.string().describe("要移除的 tour id") },
    async ({ tourId }) =>
      toolText(await handleShortlistRemove(familyId, tourId)),
  );

  return server;
}
