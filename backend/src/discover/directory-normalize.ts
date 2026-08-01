/**
 * Strips protocol/path/query and a leading `www.`, lowercased — used to
 * match companies by domain. Never throws: unparseable input just means "no
 * domain to match on", not a reason to block Company creation.
 */
export function normalizeWebsiteDomain(website?: string | null): string | null {
  if (!website) return null;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(website)
      ? website
      : `https://${website}`;
    const host = new URL(withScheme).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

// Unicode "combining diacritical marks" block (U+0300-U+036F): what NFD
// normalization splits accents into, e.g. "é" -> "e" + U+0301. Filtering
// this range after NFD is the standard dependency-free accent-stripping
// technique (avoids embedding literal combining characters in source).
const COMBINING_MARK_MIN = 0x0300;
const COMBINING_MARK_MAX = 0x036f;

function stripCombiningMarks(input: string): string {
  return Array.from(input)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < COMBINING_MARK_MIN || code > COMBINING_MARK_MAX;
    })
    .join('');
}

/** Lowercase/trimmed/diacritic-stripped fallback match key when no website is set. */
export function normalizeCompanyName(name: string): string {
  return stripCombiningMarks(name.normalize('NFD'))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
