import exifr from "exifr";

import { logger } from "./logger";

/** Parse EXIF DateTimeOriginal from image bytes; returns undefined when absent. */
export async function parseDateTimeOriginal(
  buffer: Buffer,
): Promise<Date | undefined> {
  try {
    const parsed = (await exifr.parse(buffer, {
      pick: ["DateTimeOriginal"],
      reviveValues: true,
    })) as { DateTimeOriginal?: unknown } | undefined;

    const value = parsed?.DateTimeOriginal;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    return undefined;
  } catch (error) {
    logger.debug({ error }, "EXIF DateTimeOriginal parse failed");
    return undefined;
  }
}
