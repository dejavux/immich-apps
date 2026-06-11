import { parseDateTimeOriginal } from "./exif-datetime";
import {
  LINE_BOT_RECEIVED_TIME_DESCRIPTION,
  LINE_FORWARDED_TAG,
  resolveUploadTimestamps,
} from "./upload-timestamps";

jest.mock("./exif-datetime", () => ({
  parseDateTimeOriginal: jest.fn(),
}));

const mockedParse = parseDateTimeOriginal as jest.Mock;

describe("resolveUploadTimestamps", () => {
  beforeEach(() => {
    mockedParse.mockReset();
  });

  it("omits file timestamps when EXIF DateTimeOriginal exists", async () => {
    const shotAt = new Date("2024-03-15T08:30:00.000Z");
    mockedParse.mockResolvedValue(shotAt);

    const plan = await resolveUploadTimestamps(
      Buffer.from("with-exif"),
      "2026-06-11T12:00:00.000Z",
    );

    expect(plan).toEqual({
      omitFileTimestamps: true,
      usedBotReceivedTime: false,
      exifDateTimeOriginal: shotAt.toISOString(),
    });
  });

  it("uses event time when EXIF is absent", async () => {
    mockedParse.mockResolvedValue(undefined);
    const eventTime = "2026-06-11T12:00:00.000Z";

    const plan = await resolveUploadTimestamps(
      Buffer.from("no-exif"),
      eventTime,
    );

    expect(plan).toEqual({
      omitFileTimestamps: false,
      fileCreatedAt: eventTime,
      fileModifiedAt: eventTime,
      usedBotReceivedTime: true,
    });
  });
});

describe("line-forwarded constants", () => {
  it("exports tag and description for bot-received fallback", () => {
    expect(LINE_FORWARDED_TAG).toBe("line-forwarded");
    expect(LINE_BOT_RECEIVED_TIME_DESCRIPTION).toBe(
      "日期為 Bot 收到時間，非拍攝時間",
    );
  });
});
