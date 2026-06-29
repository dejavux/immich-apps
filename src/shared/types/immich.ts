export interface ImmichAsset {
  id: string;
  deviceAssetId?: string;
  deviceId?: string;
  type?: string;
  originalPath?: string;
  status?: string;
}

export interface UploadDeviceInfo {
  deviceId: string;
  deviceAssetId: string;
}

export interface UploadAssetOptions extends UploadDeviceInfo {
  filename: string;
  contentType: string;
  /** Omitted when Immich should read EXIF from the uploaded file. */
  fileCreatedAt?: string;
  fileModifiedAt?: string;
  source: "line-image" | "line-file";
}

export interface AssetMetadataSnapshot {
  hasMetadata: boolean;
  localDateTime?: string;
  exifMake?: string;
  exifModel?: string;
  peopleCount: number;
  tagCount: number;
}

export interface WaitForAssetMetadataOptions {
  timeoutMs: number;
  pollIntervalMs?: number;
}

/** Immich v2 album create/list (open-api/immich-openapi-specs.json). */
export interface ImmichAlbumSummary {
  id: string;
  albumName: string;
}

export interface ImmichPersonSummary {
  id: string;
  name: string;
  birthDate?: string | null;
}

export interface PhotoSearchAssetHit {
  id: string;
  originalFileName?: string;
  localDateTime?: string;
  country?: string;
  city?: string;
  personNames?: string[];
}

export interface MetadataSearchParams {
  personIds?: string[];
  takenAfter?: string;
  takenBefore?: string;
  /** Immich reverse-geocoded country name, e.g. "Japan", "Taiwan, Province of China". */
  country?: string;
  /** Immich city name, e.g. "Taipei", "Tokyo". */
  city?: string;
  size?: number;
  page?: number;
}

export interface SmartSearchParams {
  query: string;
  personIds?: string[];
  takenAfter?: string;
  takenBefore?: string;
  /** Immich reverse-geocoded country name. */
  country?: string;
  /** Immich city name. */
  city?: string;
  size?: number;
  page?: number;
}
