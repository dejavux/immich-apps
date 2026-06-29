/** Runtime aliases learned from Immich distinct EXIF country values. */

const immichCountryAliases = new Map<string, string>();

function aliasKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Register alternate spellings that should resolve to a canonical Immich country name. */
export function registerImmichCountryAlias(
  alias: string,
  canonical: string,
): void {
  const key = aliasKey(alias);
  const canon = canonical.trim();
  if (!key || !canon) {
    return;
  }
  immichCountryAliases.set(key, canon);
}

/** Bulk-register Immich explore / distinct country values (identity + short forms). */
export function registerImmichCountryValues(countries: string[]): void {
  for (const country of countries) {
    const trimmed = country.trim();
    if (!trimmed) {
      continue;
    }
    registerImmichCountryAlias(trimmed, trimmed);
    const short = trimmed.split(",")[0]?.trim();
    if (short && short !== trimmed) {
      registerImmichCountryAlias(short, trimmed);
    }
  }
}

export function resolveImmichCountryAlias(
  country: string | undefined | null,
): string | undefined {
  if (!country?.trim()) {
    return undefined;
  }
  const trimmed = country.trim();
  return immichCountryAliases.get(aliasKey(trimmed)) ?? trimmed;
}

/** @internal test helper */
export function resetImmichCountryAliasesForTest(): void {
  immichCountryAliases.clear();
}
