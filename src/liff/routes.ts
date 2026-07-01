import { Router, type Request, type Response } from "express";

import { renderLiffAdminPage } from "./admin-page";
import { renderLiffHubPage } from "./hub-page";
import { liffEntryUrl, liffHubPageUrl } from "./liff-shared";
import { renderLiffSettingsPage } from "./settings-page";

export const liffRoutes = Router();

/** LIFF endpoint 為 /liff/hub 時，liff.line.me/{id}/settings → /liff/hub/settings */
function sendSettings(_req: Request, res: Response): void {
  res.type("html").send(renderLiffSettingsPage());
}

function sendAdmin(_req: Request, res: Response): void {
  res.type("html").send(renderLiffAdminPage());
}

liffRoutes.get("/hub", (_req, res) => {
  res.type("html").send(renderLiffHubPage());
});

liffRoutes.get("/hub/settings", sendSettings);
liffRoutes.get("/hub/admin", sendAdmin);

/** 舊路徑：導向 LIFF endpoint 下的 canonical path */
liffRoutes.get("/settings", (req, res) => {
  const suffix = req.url.slice("/settings".length) || "";
  res.redirect(302, `/liff/hub/settings${suffix}`);
});

liffRoutes.get("/admin", (req, res) => {
  const suffix = req.url.slice("/admin".length) || "";
  res.redirect(302, `/liff/hub/admin${suffix}`);
});

liffRoutes.get("/_meta", (_req, res) => {
  res.json({
    hubPage: liffHubPageUrl(),
    liffUrl: liffEntryUrl(),
  });
});
