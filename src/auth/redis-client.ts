import { createClient } from "redis";

import { env } from "../line-bot/config/env";

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let connectPromise: Promise<RedisClient | null> | null = null;

export async function getSharedRedisClient(): Promise<RedisClient | null> {
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
        console.error("[redis] client error", error);
      });
      await client.connect();
      redisClient = client;
      return client;
    })().catch((error) => {
      console.error("[redis] connect failed", error);
      connectPromise = null;
      return null;
    });
  }
  return connectPromise;
}
