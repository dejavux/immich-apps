import { createClient } from "redis";

import { env } from "../config/env.js";

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let connectPromise: Promise<RedisClient | null> | null = null;

export async function getRedisClient(): Promise<RedisClient | null> {
  if (!env.redisUrl) {
    return null;
  }
  if (redisClient?.isOpen) {
    return redisClient;
  }
  if (!connectPromise) {
    connectPromise = (async () => {
      const client = createClient({ url: env.redisUrl });
      client.on("error", (error) => {
        console.error("[planner/redis] client error", error);
      });
      await client.connect();
      redisClient = client;
      return client;
    })().catch((error) => {
      console.error("[planner/redis] connect failed", error);
      connectPromise = null;
      return null;
    });
  }
  return connectPromise;
}

export async function resetRedisClientForTests(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
  }
  redisClient = null;
  connectPromise = null;
}
