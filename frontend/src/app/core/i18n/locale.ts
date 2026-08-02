/**
 * The locales the product ships. Kept in lockstep with the backend allowlist
 * (`SUPPORTED_LOCALES` in users/dto/update-settings.dto.ts) — the server is the
 * authority, this list only decides what the switcher offers.
 */
export const SUPPORTED_LOCALES = ['fr', 'en', 'de', 'es'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

/** Locales whose script runs right-to-left. None today; the layout still honours it. */
const RTL_LOCALES = new Set<Locale>();

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function directionOf(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

/** Endonyms: a language is always listed in its own language, never translated. */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
};

/**
 * Best supported match for a browser `Accept-Language`-style list. Matches on
 * the primary subtag only (`de-AT` → `de`), which is all the catalogue
 * distinguishes today.
 */
export function negotiateLocale(
  preferred: readonly string[],
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return fallback;
}
