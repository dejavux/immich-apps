const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "heic",
  "heif",
  "webp",
  "gif",
  "tif",
  "tiff",
  "dng",
  "cr2",
  "nef",
  "arw",
  "raf",
  "orf",
]);

const VIDEO_EXTENSIONS = new Set([
  "mov",
  "mp4",
  "m4v",
  "avi",
  "mkv",
  "webm",
  "hevc",
  "3gp",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/tiff": "tiff",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
  "video/3gpp": "3gp",
};

export function extensionFromFileName(fileName: string): string | undefined {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) {
    return undefined;
  }
  const ext = fileName.slice(dot + 1).toLowerCase();
  return ext.length > 0 ? ext : undefined;
}

export function isImageFileName(fileName: string): boolean {
  const ext = extensionFromFileName(fileName);
  return ext !== undefined && IMAGE_EXTENSIONS.has(ext);
}

export function isVideoFileName(fileName: string): boolean {
  const ext = extensionFromFileName(fileName);
  return ext !== undefined && VIDEO_EXTENSIONS.has(ext);
}

export function isSupportedMediaFileName(fileName: string): boolean {
  return isImageFileName(fileName) || isVideoFileName(fileName);
}

export function extensionFromContentType(
  contentType: string | undefined,
): string | undefined {
  if (!contentType) {
    return undefined;
  }
  const base = contentType.split(";")[0]?.trim().toLowerCase();
  if (!base) {
    return undefined;
  }
  return MIME_TO_EXT[base];
}

export function resolveUploadFilename(params: {
  messageId: string;
  preferredFileName?: string;
  contentType?: string;
  fallbackExt?: string;
}): { filename: string; contentType: string } {
  const {
    messageId,
    preferredFileName,
    contentType,
    fallbackExt = "jpg",
  } = params;

  if (preferredFileName?.trim()) {
    const name = preferredFileName.trim();
    const ext = extensionFromFileName(name);
    const mime =
      contentType?.split(";")[0]?.trim() ??
      (ext ? mimeFromExtension(ext) : undefined) ??
      "application/octet-stream";
    return { filename: name, contentType: mime };
  }

  const ext = extensionFromContentType(contentType) ?? fallbackExt;
  const mime =
    contentType?.split(";")[0]?.trim() ??
    mimeFromExtension(ext) ??
    (VIDEO_EXTENSIONS.has(ext) ? "video/mp4" : "image/jpeg");
  return { filename: `line-${messageId}.${ext}`, contentType: mime };
}

function mimeFromExtension(ext: string): string | undefined {
  for (const [mime, mapped] of Object.entries(MIME_TO_EXT)) {
    if (mapped === ext) {
      return mime;
    }
  }
  if (VIDEO_EXTENSIONS.has(ext)) {
    return ext === "mov" ? "video/quicktime" : "video/mp4";
  }
  return undefined;
}

export function lineEventTimeIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}
