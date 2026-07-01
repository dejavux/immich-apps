import { Router } from "express";

import { renderLiffAdminPage } from "./admin-page";
import { renderLiffHubPage } from "./hub-page";
import { liffEntryUrl, liffHubPageUrl } from "./liff-shared";
import { renderLiffSettingsPage } from "./settings-page";

export const liffRoutes = Router();

liffRoutes.get("/hub", (_req, res) => {
  res.type("html").send(renderLiffHubPage());
});

liffRoutes.get("/settings", (_req, res) => {
  res.type("html").send(renderLiffSettingsPage());
});

liffRoutes.get("/admin", (_req, res) => {
  res.type("html").send(renderLiffAdminPage());
});

liffRoutes.get("/_meta", (_req, res) => {
  res.json({
    hubPage: liffHubPageUrl(),
    liffUrl: liffEntryUrl(),
  });
});
