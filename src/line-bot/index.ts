import express from "express";
import { middleware } from "@line/bot-sdk";

import { authRoutes } from "../auth/routes";
import { isAuthSessionConfigured } from "../auth/session";
import { liffRoutes } from "../liff/routes";
import { env } from "./config/env";
import { handleWebhookEvents } from "./handlers/line-webhook";
import { registerMediaProxyRoutes } from "./routes/media-proxy";
import { ensureDefaultRichMenu } from "./services/rich-menu";
import { logger } from "../shared/logger";
import { ImmichClient } from "../shared/immich-client";
import { registerImmichCountryValues } from "./services/country-lookup-runtime";
import { register } from "./metrics";

import immichAliases from "./data/country-lookup-immich-aliases.json";

const app = express();
const immichClient = new ImmichClient(env.immichBaseUrl, env.immichApiKey);

app.use(express.json());

registerMediaProxyRoutes(app, immichClient);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "immich-line-bot",
    liffConfigured: Boolean(env.liffId),
    authSessionConfigured: isAuthSessionConfigured(),
    redisConfigured: Boolean(env.redisUrl),
  });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api/v1/auth", authRoutes);
app.use("/liff", liffRoutes);

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

  if (env.lineRichMenuAutoSetup) {
    void ensureDefaultRichMenu(env.lineAccessToken).catch((error) => {
      logger.error({ error }, "Rich menu setup failed");
    });
  }

  void bootstrapCountryAliases(immichClient);
});

async function bootstrapCountryAliases(client: ImmichClient): Promise<void> {
  const rawCountries = (immichAliases as { countries?: unknown }).countries;
  const fileCountries = Array.isArray(rawCountries)
    ? rawCountries.filter((value): value is string => typeof value === "string")
    : [];
  if (fileCountries.length > 0) {
    registerImmichCountryValues(fileCountries);
  }

  try {
    const exploreCountries = await client.fetchExploreCountries();
    registerImmichCountryValues(exploreCountries);
    logger.info(
      { count: exploreCountries.length },
      "Registered Immich country aliases",
    );
  } catch (error) {
    logger.warn({ error }, "Immich explore country bootstrap skipped");
  }
}
