import type { Express, Request, Response } from "express";

import { ImmichClient } from "../../shared/immich-client";
import { logger } from "../../shared/logger";
import { isValidAssetId } from "../services/line-search-reply";

export function registerMediaProxyRoutes(
  app: Express,
  immichClient: ImmichClient,
): void {
  app.get(
    "/media/assets/:assetId/preview.jpg",
    async (req: Request, res: Response) => {
      const rawId = req.params.assetId;
      const assetId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!assetId || !isValidAssetId(assetId)) {
        res.sendStatus(400);
        return;
      }

      try {
        const thumbnail = await immichClient.fetchAssetThumbnail(
          assetId,
          "preview",
        );
        res.set("Content-Type", thumbnail.contentType);
        res.set("Cache-Control", "public, max-age=3600");
        res.send(thumbnail.data);
      } catch (error) {
        logger.warn({ error, assetId }, "Thumbnail proxy failed");
        res.sendStatus(404);
      }
    },
  );
}
