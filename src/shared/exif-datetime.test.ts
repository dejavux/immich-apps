import exifr from "exifr";

import { parseDateTimeOriginal } from "./exif-datetime";

jest.mock("exifr", () => ({
  __esModule: true,
  default: {
    parse: jest.fn(),
  },
}));

const mockedParse = exifr.parse as jest.Mock;

describe("parseDateTimeOriginal", () => {
  beforeEach(() => {
    mockedParse.mockReset();
  });

  it("returns Date when EXIF DateTimeOriginal is present", async () => {
    const shotAt = new Date("2024-03-15T08:30:00.000Z");
    mockedParse.mockResolvedValue({ DateTimeOriginal: shotAt });

    const result = await parseDateTimeOriginal(Buffer.from("fake-image"));

    expect(result).toEqual(shotAt);
    expect(mockedParse).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ pick: ["DateTimeOriginal"] }),
    );
  });

  it("returns undefined when DateTimeOriginal is missing", async () => {
    mockedParse.mockResolvedValue({});

    const result = await parseDateTimeOriginal(Buffer.from("fake-image"));

    expect(result).toBeUndefined();
  });

  it("returns undefined when parse throws", async () => {
    mockedParse.mockRejectedValue(new Error("not an image"));

    const result = await parseDateTimeOriginal(Buffer.from("not-image"));

    expect(result).toBeUndefined();
  });
});
