import {
  isSupportedMediaFileName,
  isVideoFileName,
  resolveUploadFilename,
} from "./media-types";

describe("media-types video", () => {
  it("detects video extensions", () => {
    expect(isVideoFileName("clip.MOV")).toBe(true);
    expect(isVideoFileName("clip.mp4")).toBe(true);
    expect(isVideoFileName("photo.jpg")).toBe(false);
  });

  it("accepts video in supported media", () => {
    expect(isSupportedMediaFileName("vacation.m4v")).toBe(true);
    expect(isSupportedMediaFileName("notes.txt")).toBe(false);
  });

  it("resolves mp4 filename from content type", () => {
    const resolved = resolveUploadFilename({
      messageId: "msg1",
      contentType: "video/mp4",
      fallbackExt: "mp4",
    });
    expect(resolved.filename).toBe("line-msg1.mp4");
    expect(resolved.contentType).toBe("video/mp4");
  });
});
