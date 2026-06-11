import { parseDateTimeOriginal } from "./exif-datetime";

export const LINE_FORWARDED_TAG = "line-forwarded";
export const LINE_BOT_RECEIVED_TIME_DESCRIPTION =
  "日期為 Bot 收到時間，非拍攝時間";

export interface UploadTimestampPlan {
  /** When true, omit fileCreatedAt/fileModifiedAt so Immich reads EXIF from the file. */
  omitFileTimestamps: boolean;
  fileCreatedAt?: string;
  fileModifiedAt?: string;
  /** True when falling back to LINE webhook event.timestamp. */
  usedBotReceivedTime: boolean;
  exifDateTimeOriginal?: string;
}

export async function resolveUploadTimestamps(
  buffer: Buffer,
  eventTimeIso: string,
): Promise<UploadTimestampPlan> {
  const exifDate = await parseDateTimeOriginal(buffer);

  if (exifDate) {
    return {
      omitFileTimestamps: true,
      usedBotReceivedTime: false,
      exifDateTimeOriginal: exifDate.toISOString(),
    };
  }

  return {
    omitFileTimestamps: false,
    fileCreatedAt: eventTimeIso,
    fileModifiedAt: eventTimeIso,
    usedBotReceivedTime: true,
  };
}
