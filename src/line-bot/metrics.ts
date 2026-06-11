import client from "prom-client";

export const register = new client.Registry();

client.collectDefaultMetrics({ register });

export const webhookEventsTotal = new client.Counter({
  name: "immich_line_bot_webhook_events_total",
  help: "LINE webhook events received",
  labelNames: ["type"] as const,
  registers: [register],
});

export const uploadsTotal = new client.Counter({
  name: "immich_line_bot_uploads_total",
  help: "Immich upload attempts from LINE Bot",
  labelNames: ["source", "status"] as const,
  registers: [register],
});

export const uploadDurationSeconds = new client.Histogram({
  name: "immich_line_bot_upload_duration_seconds",
  help: "Immich upload duration in seconds",
  labelNames: ["source"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

export const imageSetBatchesTotal = new client.Counter({
  name: "immich_line_bot_imageset_batches_total",
  help: "imageSet batch summaries sent",
  registers: [register],
});
