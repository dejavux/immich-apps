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
