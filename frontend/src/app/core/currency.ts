/**
 * ISO-4217 code guessed from the region the browser reports.
 *
 * Deliberately small and deliberately a guess: it only has to be right often
 * enough to save one edit on a brand-new account. Whatever the user actually
 * submits is remembered and takes over from the next application onwards, so a
 * wrong entry here costs one correction, never a wrong amount — the code is
 * always stored alongside the value.
 */
const REGION_CURRENCY: Record<string, string> = {
  AT: 'EUR',
  BE: 'EUR',
  DE: 'EUR',
  ES: 'EUR',
  FI: 'EUR',
  FR: 'EUR',
  GR: 'EUR',
  IE: 'EUR',
  IT: 'EUR',
  LU: 'EUR',
  NL: 'EUR',
  PT: 'EUR',
  CH: 'CHF',
  CZ: 'CZK',
  DK: 'DKK',
  NO: 'NOK',
  PL: 'PLN',
  SE: 'SEK',
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  JP: 'JPY',
  BR: 'BRL',
  MX: 'MXN',
  IN: 'INR',
  MA: 'MAD',
  TN: 'TND',
};

export const FALLBACK_CURRENCY = 'EUR';

/** True for a well-formed ISO-4217 alphabetic code. */
export function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

/**
 * First currency whose region this browser advertises, else `EUR`. Takes the
 * language list rather than a single tag because the first entry is often
 * region-less (`en`) while a later one is not (`en-GB`).
 */
export function currencyForLanguages(languages: readonly string[]): string {
  for (const tag of languages) {
    const region = regionOf(tag);
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return FALLBACK_CURRENCY;
}

function regionOf(tag: string): string | null {
  try {
    return new Intl.Locale(tag).region ?? null;
  } catch {
    // A malformed tag from the platform is not worth failing over.
    return null;
  }
}
