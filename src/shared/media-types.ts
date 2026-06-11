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

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/tiff": "tiff",
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
    "image/jpeg";
  return { filename: `line-${messageId}.${ext}`, contentType: mime };
}

function mimeFromExtension(ext: string): string | undefined {
  for (const [mime, mapped] of Object.entries(MIME_TO_EXT)) {
    if (mapped === ext) {
      return mime;
    }
  }
  return undefined;
}

export function lineEventTimeIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}
