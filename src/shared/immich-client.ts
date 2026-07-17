import axios, { type AxiosError } from "axios";
import FormData from "form-data";

import {
  formatMetadataNote,
  snapshotFromAssetResponse,
} from "./asset-metadata";
import { logger } from "./logger";
import { mapSearchAssetItem } from "./map-search-asset";
import type {
  AssetMetadataSnapshot,
  ImmichAlbumSummary,
  ImmichAsset,
  MetadataSearchParams,
  SmartSearchParams,
  ImmichPersonSummary,
  PhotoSearchAssetHit,
  UploadAssetOptions,
  WaitForAssetMetadataOptions,
} from "./types/immich";

const DEFAULT_POLL_INTERVAL_MS = 1_500;

export class ImmichClient {
  private readonly albumIdCache = new Map<string, string>();

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private headers(json = false): Record<string, string> {
    const base: Record<string, string> = {
      "x-api-key": this.apiKey,
      Accept: "application/json",
    };
    if (json) {
      base["Content-Type"] = "application/json";
    }
    return base;
  }

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
      if (options.deviceId) {
        attemptForm.append("deviceId", options.deviceId);
      }
      if (options.deviceAssetId) {
        attemptForm.append("deviceAssetId", options.deviceAssetId);
      }
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
              ...this.headers(),
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

  async getAsset(assetId: string): Promise<unknown> {
    const endpoints = [`/api/assets/${assetId}`, `/api/asset/${assetId}`];

    let lastError: unknown;
    for (const path of endpoints) {
      try {
        const response = await axios.get(`${this.baseUrl}${path}`, {
          headers: this.headers(),
          timeout: 30_000,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        const status = (error as AxiosError).response?.status;
        if (status === 404) {
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Poll until Immich metadata extraction completes (hasMetadata) or timeout.
   * Immich v2 no longer exposes legacy asset.status=READY; hasMetadata is the signal.
   */
  async waitForAssetMetadata(
    assetId: string,
    options: WaitForAssetMetadataOptions,
  ): Promise<AssetMetadataSnapshot | undefined> {
    if (options.timeoutMs <= 0) {
      return undefined;
    }

    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + options.timeoutMs;

    while (Date.now() < deadline) {
      const data = await this.getAsset(assetId);
      const snapshot = snapshotFromAssetResponse(data);
      if (snapshot.hasMetadata) {
        return snapshot;
      }
      await sleep(Math.min(pollIntervalMs, deadline - Date.now()));
    }

    return undefined;
  }

  buildMetadataReplyNote(snapshot: AssetMetadataSnapshot | undefined): string {
    if (!snapshot) {
      return "⏳ 背景處理中（縮圖 / EXIF / 人臉 / 智慧搜尋）";
    }
    const formatted = formatMetadataNote(snapshot);
    return formatted.length > 0 ? formatted : "✅ Metadata 已就緒";
  }

  assetPageUrl(assetId: string, webBaseUrl: string): string {
    return `${webBaseUrl}/photos/${assetId}`;
  }

  /** Set asset description (Immich v2: PUT /api/assets/{id}). */
  async updateAssetDescription(
    assetId: string,
    description: string,
  ): Promise<void> {
    const attempts: Array<{ path: string; method: "put" | "patch" }> = [
      { path: `/api/assets/${assetId}`, method: "put" },
      { path: `/api/assets/${assetId}`, method: "patch" },
      { path: `/api/asset/${assetId}`, method: "put" },
      { path: `/api/asset/${assetId}`, method: "patch" },
    ];

    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        await axios.request({
          method: attempt.method,
          url: `${this.baseUrl}${attempt.path}`,
          data: { description },
          headers: this.headers(true),
          timeout: 30_000,
        });
        return;
      } catch (error) {
        lastError = error;
        const status = (error as AxiosError).response?.status;
        if (status === 404 || status === 405) {
          logger.warn(
            { path: attempt.path, method: attempt.method, assetId },
            "Immich asset description path unavailable, trying fallback",
          );
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  /** Find album by exact name or create it (Immich v2 /api/albums). */
  async findOrCreateAlbum(albumName: string): Promise<string> {
    const cached = this.albumIdCache.get(albumName);
    if (cached) {
      return cached;
    }

    const list = await axios.get<ImmichAlbumSummary[]>(
      `${this.baseUrl}/api/albums`,
      {
        headers: this.headers(),
        timeout: 30_000,
      },
    );

    const existing = list.data.find((album) => album.albumName === albumName);
    if (existing) {
      this.albumIdCache.set(albumName, existing.id);
      return existing.id;
    }

    const created = await axios.post<{ id: string; albumName: string }>(
      `${this.baseUrl}/api/albums`,
      { albumName },
      {
        headers: this.headers(true),
        timeout: 30_000,
      },
    );

    this.albumIdCache.set(albumName, created.data.id);
    return created.data.id;
  }

  async addAssetsToAlbum(albumId: string, assetIds: string[]): Promise<void> {
    if (assetIds.length === 0) {
      return;
    }

    await axios.put(
      `${this.baseUrl}/api/albums/${albumId}/assets`,
      { ids: assetIds },
      {
        headers: this.headers(true),
        timeout: 30_000,
      },
    );
  }

  async searchPersonByName(name: string): Promise<ImmichPersonSummary[]> {
    const response = await axios.get<ImmichPersonSummary[]>(
      `${this.baseUrl}/api/search/person`,
      {
        headers: this.headers(),
        params: { name, withHidden: false },
        timeout: 30_000,
      },
    );
    return response.data;
  }

  async searchMetadata(
    params: MetadataSearchParams,
  ): Promise<{ items: PhotoSearchAssetHit[]; total: number }> {
    const body: Record<string, unknown> = {
      size: params.size ?? 20,
      page: params.page ?? 1,
      withExif: true,
      withPeople: true,
    };
    if (params.personIds?.length) {
      body.personIds = params.personIds;
    }
    if (params.takenAfter) {
      body.takenAfter = params.takenAfter;
    }
    if (params.takenBefore) {
      body.takenBefore = params.takenBefore;
    }
    if (params.country) {
      body.country = params.country;
    }
    if (params.city) {
      body.city = params.city;
    }

    const response = await axios.post<{
      assets?: {
        items?: Array<Record<string, unknown>>;
        total?: number;
      };
    }>(`${this.baseUrl}/api/search/metadata`, body, {
      headers: this.headers(true),
      timeout: 60_000,
    });

    const items = (response.data.assets?.items ?? []).map((item) =>
      mapSearchAssetItem(item),
    );

    return {
      items: items.filter((item) => item.id.length > 0),
      total: response.data.assets?.total ?? items.length,
    };
  }

  async searchSmart(
    params: SmartSearchParams,
  ): Promise<{ items: PhotoSearchAssetHit[]; total: number }> {
    const body: Record<string, unknown> = {
      query: params.query,
      size: params.size ?? 20,
      page: params.page ?? 1,
      withExif: true,
      withPeople: true,
    };
    if (params.personIds?.length) {
      body.personIds = params.personIds;
    }
    if (params.takenAfter) {
      body.takenAfter = params.takenAfter;
    }
    if (params.takenBefore) {
      body.takenBefore = params.takenBefore;
    }
    if (params.country) {
      body.country = params.country;
    }
    if (params.city) {
      body.city = params.city;
    }

    const response = await axios.post<{
      assets?: {
        items?: Array<Record<string, unknown>>;
        total?: number;
      };
    }>(`${this.baseUrl}/api/search/smart`, body, {
      headers: this.headers(true),
      timeout: 90_000,
    });

    const items = (response.data.assets?.items ?? []).map((item) =>
      mapSearchAssetItem(item),
    );

    return {
      items: items.filter((item) => item.id.length > 0),
      total: response.data.assets?.total ?? items.length,
    };
  }

  async fetchExploreCountries(): Promise<string[]> {
    const response = await axios.get<
      Array<{ fieldName?: string; items?: Array<{ value?: string }> }>
    >(`${this.baseUrl}/api/search/explore`, {
      headers: this.headers(),
      timeout: 30_000,
    });

    const countries = new Set<string>();
    for (const section of response.data) {
      if (
        section.fieldName !== "exifInfo.country" &&
        section.fieldName !== "country"
      ) {
        continue;
      }
      for (const item of section.items ?? []) {
        const value = item.value?.trim();
        if (value) {
          countries.add(value);
        }
      }
    }
    return [...countries].sort();
  }

  async fetchAssetThumbnail(
    assetId: string,
    size: "preview" | "thumbnail" = "preview",
  ): Promise<{ data: Buffer; contentType: string }> {
    const response = await axios.get<ArrayBuffer>(
      `${this.baseUrl}/api/assets/${assetId}/thumbnail`,
      {
        headers: {
          "x-api-key": this.apiKey,
          Accept: "image/*",
        },
        params: { size },
        responseType: "arraybuffer",
        timeout: 30_000,
      },
    );

    const contentType =
      typeof response.headers["content-type"] === "string"
        ? response.headers["content-type"]
        : "image/jpeg";

    return {
      data: Buffer.from(response.data),
      contentType,
    };
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
          headers: this.headers(true),
          timeout: 30_000,
        },
      );
    }
  }

  private async findOrCreateTag(name: string): Promise<string> {
    const list = await axios.get<{ id: string; name: string }[]>(
      `${this.baseUrl}/api/tags`,
      {
        headers: this.headers(),
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
          headers: this.headers(true),
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
            headers: this.headers(),
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

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
