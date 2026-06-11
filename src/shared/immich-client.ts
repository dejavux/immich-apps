import axios, { type AxiosError } from "axios";
import FormData from "form-data";

import type { ImmichAsset, UploadAssetOptions } from "./types/immich";
import { logger } from "./logger";

export class ImmichClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async uploadAsset(
    imageBuffer: Buffer,
    options: UploadAssetOptions,
  ): Promise<ImmichAsset> {
    const endpoints = ["/api/assets", "/api/asset/upload"];

    let lastError: unknown;
    for (const path of endpoints) {
      const attemptForm = new FormData();
      attemptForm.append("assetData", imageBuffer, {
        filename: options.filename,
        contentType: options.contentType,
      });
      attemptForm.append("deviceId", options.deviceId);
      attemptForm.append("deviceAssetId", options.deviceAssetId);
      attemptForm.append("fileCreatedAt", options.fileCreatedAt);
      attemptForm.append("fileModifiedAt", options.fileModifiedAt);

      try {
        const response = await axios.post<ImmichAsset>(
          `${this.baseUrl}${path}`,
          attemptForm,
          {
            headers: {
              ...attemptForm.getHeaders(),
              "x-api-key": this.apiKey,
              Accept: "application/json",
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 120_000,
          },
        );
        return response.data;
      } catch (error) {
        lastError = error;
        const status = (error as AxiosError).response?.status;
        if (status === 404) {
          logger.warn(
            { path },
            "Immich upload path not found, trying fallback",
          );
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  assetPageUrl(assetId: string, webBaseUrl: string): string {
    return `${webBaseUrl}/photos/${assetId}`;
  }
}
