import type { Express, Request, Response } from "express";
import { register } from "prom-client";

export function registerHealthRoutes(app: Express): void {
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "planner" });
  });

  app.get("/metrics", async (_req: Request, res: Response) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });
}
