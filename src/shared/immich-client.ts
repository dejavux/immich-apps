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
      if (options.fileCreatedAt) {
        attemptForm.append("fileCreatedAt", options.fileCreatedAt);
      }
      if (options.fileModifiedAt) {
        attemptForm.append("fileModifiedAt", options.fileModifiedAt);
      }

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

  /** Set asset description (Immich assets API). */
  async updateAssetDescription(
    assetId: string,
    description: string,
  ): Promise<void> {
    const endpoints = [`/api/assets/${assetId}`, `/api/asset/${assetId}`];

    let lastError: unknown;
    for (const path of endpoints) {
      try {
        await axios.patch(
          `${this.baseUrl}${path}`,
          { description },
          {
            headers: {
              "x-api-key": this.apiKey,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            timeout: 30_000,
          },
        );
        return;
      } catch (error) {
        lastError = error;
        const status = (error as AxiosError).response?.status;
        if (status === 404 || status === 405) {
          logger.warn(
            { path, assetId },
            "Immich asset description path unavailable, trying fallback",
          );
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  /** Attach tags to an asset (creates tags if missing). */
  async tagAsset(assetId: string, tagNames: string[]): Promise<void> {
    const unique = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))];
    if (unique.length === 0) {
      return;
    }

    for (const name of unique) {
      const tagId = await this.findOrCreateTag(name);
      await axios.put(
        `${this.baseUrl}/api/tags/${tagId}/assets`,
        { ids: [assetId] },
        {
          headers: {
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 30_000,
        },
      );
    }
  }

  private async findOrCreateTag(name: string): Promise<string> {
    const list = await axios.get<{ id: string; name: string }[]>(
      `${this.baseUrl}/api/tags`,
      {
        headers: { "x-api-key": this.apiKey, Accept: "application/json" },
        timeout: 30_000,
      },
    );

    const existing = list.data.find((t) => t.name === name);
    if (existing) {
      return existing.id;
    }

    try {
      const created = await axios.post<{ id: string; name: string }>(
        `${this.baseUrl}/api/tags`,
        { name },
        {
          headers: {
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 30_000,
        },
      );
      return created.data.id;
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (status === 409) {
        const retry = await axios.get<{ id: string; name: string }[]>(
          `${this.baseUrl}/api/tags`,
          {
            headers: { "x-api-key": this.apiKey, Accept: "application/json" },
            timeout: 30_000,
          },
        );
        const again = retry.data.find((t) => t.name === name);
        if (again) {
          return again.id;
        }
      }
      throw error;
    }
  }
}
