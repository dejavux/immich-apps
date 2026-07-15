import express from "express";

import { env } from "./config/env.js";
import { requireFamilyApiKey } from "./auth/middleware.js";
import { listMcpTools } from "./mcp/tools.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerFamilyRoutes } from "./routes/families.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerShortlistRoutes } from "./routes/shortlist.js";
import { registerTourRoutes } from "./routes/tours.js";
import { registerWizardRoutes } from "./routes/wizard.js";

const API_PREFIX = "/api/planner/v1";

export function createPlannerApp(): express.Express {
  const app = express();
  app.use(express.json());

  registerHealthRoutes(app);

  app.get("/", (_req, res) => {
    res.json({
      service: env.serviceName,
      apiPrefix: API_PREFIX,
      phase: "A2-search-extract-shortlist",
      mcpTools: listMcpTools().map((t) => t.name),
    });
  });

  registerAuthRoutes(app, API_PREFIX);

  app.use(API_PREFIX, (req, res, next) => {
    void requireFamilyApiKey(req, res, next);
  });

  registerFamilyRoutes(app, API_PREFIX);
  registerWizardRoutes(app, API_PREFIX);
  registerTourRoutes(app, API_PREFIX);
  registerShortlistRoutes(app, API_PREFIX);

  app.get(`${API_PREFIX}/mcp/tools`, (_req, res) => {
    res.json({ ok: true, server: env.serviceName, tools: listMcpTools() });
  });

  return app;
}

const app = createPlannerApp();

if (!process.env.JEST_WORKER_ID && process.env.PLANNER_AUTOSTART !== "0") {
  app.listen(env.port, () => {
    console.log(`[planner] listening on :${env.port} (${env.nodeEnv})`);
  });
}

export { app };
