import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { messagingApi } from "@line/bot-sdk";

import { logger } from "../../shared/logger";
import { RICH_MENU_LABELS, RICH_MENU_MESSAGES } from "./line-welcome";

const { MessagingApiClient, MessagingApiBlobClient } = messagingApi;

const MENU_WIDTH = 2500;
const MENU_HEIGHT = 843;

function resolveRichMenuImagePath(): string {
  const candidates = [
    join(__dirname, "../../../deploy/line-bot/rich-menu.jpg"),
    join(process.cwd(), "deploy/line-bot/rich-menu.jpg"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Rich menu image not found. Tried: ${candidates.join(", ")}`);
}

function richMenuImageBytes(): Buffer {
  return readFileSync(resolveRichMenuImagePath());
}

function buildRichMenuBody(): messagingApi.RichMenuRequest {
  const third = Math.floor(MENU_WIDTH / 3);
  return {
    size: { width: MENU_WIDTH, height: MENU_HEIGHT },
    selected: true,
    name: "Immich Photo Assistant",
    chatBarText: "選單",
    areas: [
      {
        bounds: { x: 0, y: 0, width: third, height: MENU_HEIGHT },
        action: {
          type: "message",
          label: RICH_MENU_LABELS.search,
          text: RICH_MENU_MESSAGES.search,
        },
      },
      {
        bounds: { x: third, y: 0, width: third, height: MENU_HEIGHT },
        action: {
          type: "message",
          label: RICH_MENU_LABELS.upload,
          text: RICH_MENU_MESSAGES.upload,
        },
      },
      {
        bounds: {
          x: third * 2,
          y: 0,
          width: MENU_WIDTH - third * 2,
          height: MENU_HEIGHT,
        },
        action: {
          type: "message",
          label: RICH_MENU_LABELS.help,
          text: RICH_MENU_MESSAGES.help,
        },
      },
    ],
  };
}

async function uploadRichMenuImage(
  blobClient: messagingApi.MessagingApiBlobClient,
  richMenuId: string,
): Promise<void> {
  await blobClient.setRichMenuImage(
    richMenuId,
    new Blob([richMenuImageBytes()], { type: "image/jpeg" }),
  );
}

/**
 * LINE does not allow replacing an image on an existing rich menu.
 * Create a fresh menu, upload the banner, swap default, then delete the old one.
 */
export async function ensureDefaultRichMenu(
  accessToken: string,
): Promise<string | undefined> {
  const client = new MessagingApiClient({ channelAccessToken: accessToken });
  const blobClient = new MessagingApiBlobClient({
    channelAccessToken: accessToken,
  });

  let previousRichMenuId: string | undefined;
  try {
    const existing = await client.getDefaultRichMenuId();
    previousRichMenuId = existing?.richMenuId;
  } catch {
    // No default menu yet.
  }

  const created = await client.createRichMenu(buildRichMenuBody());
  const richMenuId = created.richMenuId;
  if (!richMenuId) {
    throw new Error("createRichMenu returned no richMenuId");
  }

  await uploadRichMenuImage(blobClient, richMenuId);
  await client.setDefaultRichMenu(richMenuId);
  const imagePath = resolveRichMenuImagePath();
  const imageSize = richMenuImageBytes().length;
  logger.info(
    { richMenuId, previousRichMenuId, imagePath, imageSize },
    "Default rich menu refreshed",
  );

  if (previousRichMenuId && previousRichMenuId !== richMenuId) {
    try {
      await client.deleteRichMenu(previousRichMenuId);
      logger.info(
        { richMenuId: previousRichMenuId },
        "Deleted previous rich menu",
      );
    } catch (error) {
      logger.warn(
        { error, richMenuId: previousRichMenuId },
        "Failed to delete previous rich menu",
      );
    }
  }

  return richMenuId;
}
