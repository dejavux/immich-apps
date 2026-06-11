import express from "express";
import { middleware } from "@line/bot-sdk";

import { env } from "./config/env";
import { handleWebhookEvents } from "./handlers/line-webhook";
import { logger } from "../shared/logger";
import { register } from "./metrics";

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "immich-line-bot" });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.post(
  "/webhook/line",
  middleware({ channelSecret: env.lineChannelSecret }),
  (req, res) => {
    const events = req.body.events as Parameters<typeof handleWebhookEvents>[0];

    void handleWebhookEvents(events).catch((error) => {
      logger.error({ error }, "Webhook handler error");
    });

    res.sendStatus(200);
  },
);

app.listen(env.port, () => {
  logger.info(
    {
      port: env.port,
      immichBaseUrl: env.immichBaseUrl,
      webhookPath: "/webhook/line",
    },
    "Immich LINE Bot started",
  );
});
