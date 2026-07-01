import { env } from "../line-bot/config/env";

export type AuthRole = "admin" | "user";

export function resolveAuthRole(lineUserId: string): AuthRole {
  return env.adminLineUserIds.has(lineUserId) ? "admin" : "user";
}
