import type { Express, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { getPlannerStore } from "../db/client.js";
import { createPlannerMcpServer } from "./server.js";

function parseBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function resolveFamilyId(req: Request, res: Response): Promise<string | null> {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "需要 Bearer api_key" },
      id: null,
    });
    return null;
  }

  const ctx = await getPlannerStore().resolveApiKey(token);
  if (!ctx) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "api_key 無效或已撤銷" },
      id: null,
    });
    return null;
  }

  return ctx.family.id;
}

async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const familyId = await resolveFamilyId(req, res);
  if (!familyId) {
    return;
  }

  const server = createPlannerMcpServer(familyId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  } catch (error) {
    console.error("[planner/mcp] request error", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

export function registerMcpRoutes(app: Express): void {
  app.all("/mcp", async (req, res) => {
    await handleMcpRequest(req, res);
  });
}
