import { Locale } from '../locale';
import { de } from './de';
import { TranslationKey, en } from './en';
import { es } from './es';
import { fr } from './fr';

export type { TranslationKey } from './en';

/**
 * Every catalogue, keyed by locale. Exhaustive over `Locale`, so adding a
 * language to SUPPORTED_LOCALES without shipping its catalogue is a compile
 * error rather than a half-translated UI.
 */
export const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  fr,
  en,
  de,
  es,
};
