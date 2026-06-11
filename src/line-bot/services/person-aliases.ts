/** Maps LINE / user nicknames to Immich People names (SEARCH_PERSON_ALIASES). */
export function parsePersonAliases(raw: string): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const colon = trimmed.indexOf(":");
    if (colon <= 0) {
      continue;
    }
    const alias = trimmed.slice(0, colon).trim();
    const immichName = trimmed.slice(colon + 1).trim();
    if (alias && immichName) {
      aliases.set(alias, immichName);
    }
  }
  return aliases;
}

export function resolvePersonSearchName(
  displayName: string,
  aliases: Map<string, string>,
): string {
  const trimmed = displayName.trim();
  return aliases.get(trimmed) ?? trimmed;
}
