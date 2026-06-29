import type { PhotoSearchAssetHit } from "./types/photo-search";

const UUID_FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(\.[a-z0-9]+)?$/i;

export function isUuidLikeFileName(name: string | undefined): boolean {
  if (!name?.trim()) {
    return false;
  }
  const base = name.trim().split("/").pop() ?? name;
  return UUID_FILENAME_RE.test(base);
}

export function mapSearchAssetItem(
  item: Record<string, unknown>,
): PhotoSearchAssetHit {
  const exif =
    item.exifInfo && typeof item.exifInfo === "object"
      ? (item.exifInfo as Record<string, unknown>)
      : undefined;

  const people = Array.isArray(item.people) ? item.people : [];
  const personNames = people
    .map((person) => {
      if (!person || typeof person !== "object") {
        return "";
      }
      const name = (person as { name?: unknown }).name;
      return typeof name === "string" ? name.trim() : "";
    })
    .filter((name) => name.length > 0);

  return {
    id: String(item.id ?? ""),
    originalFileName:
      typeof item.originalFileName === "string"
        ? item.originalFileName
        : undefined,
    localDateTime:
      typeof item.localDateTime === "string" ? item.localDateTime : undefined,
    country: typeof exif?.country === "string" ? exif.country : undefined,
    city: typeof exif?.city === "string" ? exif.city : undefined,
    personNames: personNames.length > 0 ? personNames : undefined,
  };
}
