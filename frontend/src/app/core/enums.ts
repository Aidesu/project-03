import { Translate, TranslationKey } from './i18n';
import {
  ApplicationSource,
  EmailTemplateCategory,
  EmploymentType,
  SalaryPeriod,
  WorkMode,
} from './models';

export interface Option<T extends string> {
  value: T;
  label: string;
}

/**
 * Each enum maps its values to translation keys instead of to literal labels,
 * so the option lists are rebuilt in the active language. `satisfies` makes the
 * maps exhaustive over the enum *and* checks every key exists in the catalogue.
 */
export const WORK_MODE_KEYS = {
  ON_SITE: 'workMode.ON_SITE',
  HYBRID: 'workMode.HYBRID',
  REMOTE: 'workMode.REMOTE',
} satisfies Record<WorkMode, TranslationKey>;

export const EMPLOYMENT_TYPE_KEYS = {
  FULL_TIME: 'employmentType.FULL_TIME',
  PART_TIME: 'employmentType.PART_TIME',
  CONTRACT: 'employmentType.CONTRACT',
  INTERNSHIP: 'employmentType.INTERNSHIP',
  APPRENTICESHIP: 'employmentType.APPRENTICESHIP',
  FREELANCE: 'employmentType.FREELANCE',
  TEMPORARY: 'employmentType.TEMPORARY',
} satisfies Record<EmploymentType, TranslationKey>;

export const SOURCE_KEYS = {
  JOB_BOARD: 'source.JOB_BOARD',
  LINKEDIN: 'source.LINKEDIN',
  COMPANY_WEBSITE: 'source.COMPANY_WEBSITE',
  REFERRAL: 'source.REFERRAL',
  RECRUITER: 'source.RECRUITER',
  CAREER_FAIR: 'source.CAREER_FAIR',
  SPONTANEOUS: 'source.SPONTANEOUS',
  OTHER: 'source.OTHER',
} satisfies Record<ApplicationSource, TranslationKey>;

export const SALARY_PERIOD_KEYS = {
  HOUR: 'salaryPeriod.HOUR',
  DAY: 'salaryPeriod.DAY',
  MONTH: 'salaryPeriod.MONTH',
  YEAR: 'salaryPeriod.YEAR',
} satisfies Record<SalaryPeriod, TranslationKey>;

export const EMAIL_TEMPLATE_CATEGORY_KEYS = {
  FOLLOW_UP: 'emailCategory.FOLLOW_UP',
  THANK_YOU: 'emailCategory.THANK_YOU',
  COLD_OUTREACH: 'emailCategory.COLD_OUTREACH',
  OFFER_NEGOTIATION: 'emailCategory.OFFER_NEGOTIATION',
  WITHDRAWAL: 'emailCategory.WITHDRAWAL',
  OTHER: 'emailCategory.OTHER',
} satisfies Record<EmailTemplateCategory, TranslationKey>;

/**
 * Company headcount brackets. Free text in the schema (`Company.size`), kept
 * as a fixed list here so the values stay groupable across companies.
 */
export const COMPANY_SIZE_KEYS = {
  '1-10': 'companySize.1-10',
  '11-50': 'companySize.11-50',
  '51-200': 'companySize.51-200',
  '201-500': 'companySize.201-500',
  '501-1000': 'companySize.501-1000',
  '1000+': 'companySize.1000+',
} satisfies Record<string, TranslationKey>;

/** Builds a `<select>` option list in the active language, preserving order. */
export function optionsFrom<T extends string>(
  keys: Record<T, TranslationKey>,
  t: Translate,
): Option<T>[] {
  return (Object.keys(keys) as T[]).map((value) => ({
    value,
    label: t(keys[value]),
  }));
}

/**
 * Label for a single enum value. An unknown or unset value yields '' so the
 * caller can decide what a missing value looks like.
 */
export function labelOf<T extends string>(
  keys: Partial<Record<T, TranslationKey>>,
  value: T | null | undefined,
  t: Translate,
): string {
  if (!value) return '';
  const key = keys[value];
  return key ? t(key) : '';
}

/**
 * Same, but for values the server may extend beyond what this client knows:
 * falls back to the raw value rather than blanking.
 */
export function labelOrRaw(
  keys: Record<string, TranslationKey>,
  value: string,
  t: Translate,
): string {
  const key = keys[value];
  return key ? t(key) : value;
}

// ---- Achievements ---------------------------------------------------------
// Achievement.code is the only stable signal we have client-side, so grouping,
// ranking and the localized name/description all key off it. The server's
// `name`/`description` remain the fallback for a code this build doesn't know.

export type AchievementCategory =
  | 'applications'
  | 'offers'
  | 'discipline'
  | 'level';

export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategory[] = [
  'applications',
  'offers',
  'discipline',
  'level',
];

export const ACHIEVEMENT_CATEGORY_KEYS = {
  applications: 'achievementCategory.applications',
  offers: 'achievementCategory.offers',
  discipline: 'achievementCategory.discipline',
  level: 'achievementCategory.level',
} satisfies Record<AchievementCategory, TranslationKey>;

export function achievementCategory(code: string): AchievementCategory {
  if (code.includes('APPLICATION')) return 'applications';
  if (code.includes('OFFER') || code.includes('ACCEPTED')) return 'offers';
  if (code.includes('STREAK')) return 'discipline';
  return 'level';
}

/** Catalogue codes this build ships translations for. */
const TRANSLATED_ACHIEVEMENTS = new Set([
  'FIRST_APPLICATION',
  'TEN_APPLICATIONS',
  'TWENTY_FIVE_APPLICATIONS',
  'FIRST_OFFER',
  'OFFER_ACCEPTED',
  'STREAK_7',
  'STREAK_30',
  'LEVEL_5',
  'LEVEL_10',
]);

export function achievementName(code: string, fallback: string, t: Translate): string {
  if (!TRANSLATED_ACHIEVEMENTS.has(code)) return fallback;
  return t(`achievement.${code}.name` as TranslationKey);
}

export function achievementDescription(
  code: string,
  fallback: string,
  t: Translate,
): string {
  if (!TRANSLATED_ACHIEVEMENTS.has(code)) return fallback;
  return t(`achievement.${code}.description` as TranslationKey);
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

/** Tier numeral for the Nth achievement (ascending threshold) within a category. */
export function toRoman(n: number): string {
  return ROMAN_NUMERALS[n - 1] ?? String(n);
}
