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
