/**
 * MCP tool 名稱與 REST 對照（Phase A3 streamable HTTP 於 /mcp）
 */
export const MCP_TOOL_ROUTES = {
  wizard_start: { method: "POST", path: "/wizard/sessions" },
  wizard_status: { method: "GET", path: "/wizard/sessions/:id" },
  wizard_answer: { method: "POST", path: "/wizard/sessions/:id/answer" },
  wizard_back: { method: "POST", path: "/wizard/sessions/:id/back" },
  wizard_search: { method: "POST", path: "/wizard/sessions/:id/search" },
  extract_tour: { method: "POST", path: "/tours/extract" },
  compare_tours: { method: "POST", path: "/tours/compare" },
  shortlist_add: { method: "POST", path: "/shortlist" },
  shortlist_list: { method: "GET", path: "/shortlist" },
  shortlist_remove: { method: "DELETE", path: "/shortlist/:tourId" },
} as const;

export type McpToolName = keyof typeof MCP_TOOL_ROUTES;

export function listMcpTools(): Array<{ name: McpToolName; description: string }> {
  return [
    { name: "wizard_start", description: "建立 wizard session 並回傳第一步 prompt" },
    { name: "wizard_status", description: "查詢 session 目前步驟與已填答案" },
    { name: "wizard_answer", description: "回答目前步驟並推進狀態機" },
    { name: "wizard_back", description: "回上一步" },
    { name: "wizard_search", description: "review 確認後搜尋雄獅跟團" },
    { name: "extract_tour", description: "從旅行社 URL 深抽完整 TourSummary" },
    { name: "compare_tours", description: "2–N 筆行程對照（shortlist id 或 inline summaries）" },
    { name: "shortlist_add", description: "加入家庭候選行程（url 或 summary）" },
    { name: "shortlist_list", description: "列出家庭 shortlist" },
    { name: "shortlist_remove", description: "從 shortlist 移除指定 tourId" },
  ];
}
