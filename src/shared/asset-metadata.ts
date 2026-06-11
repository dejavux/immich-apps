import type { AssetMetadataSnapshot } from "./types/immich";

/** Map Immich GET /api/assets/{id} JSON to a compact snapshot. */
export function snapshotFromAssetResponse(
  data: unknown,
): AssetMetadataSnapshot {
  const asset = data as Record<string, unknown>;
  const exif = asset.exifInfo as Record<string, unknown> | undefined;
  const people = asset.people as unknown[] | undefined;
  const tags = asset.tags as unknown[] | undefined;

  return {
    hasMetadata: asset.hasMetadata === true,
    localDateTime:
      typeof asset.localDateTime === "string" ? asset.localDateTime : undefined,
    exifMake: typeof exif?.make === "string" ? exif.make : undefined,
    exifModel: typeof exif?.model === "string" ? exif.model : undefined,
    peopleCount: Array.isArray(people) ? people.length : 0,
    tagCount: Array.isArray(tags) ? tags.length : 0,
  };
}

export function formatMetadataNote(snapshot: AssetMetadataSnapshot): string {
  const parts: string[] = [];

  if (snapshot.localDateTime) {
    parts.push(`📅 拍攝 ${formatLocalDate(snapshot.localDateTime)}`);
  } else if (snapshot.hasMetadata) {
    parts.push("📅 已解析 metadata");
  }

  if (snapshot.exifMake || snapshot.exifModel) {
    const camera = [snapshot.exifMake, snapshot.exifModel]
      .filter(Boolean)
      .join(" ");
    parts.push(`📷 ${camera}`);
  }

  if (snapshot.peopleCount > 0) {
    parts.push(`👤 偵測 ${snapshot.peopleCount} 人`);
  }

  return parts.join("\n");
}

function formatLocalDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
