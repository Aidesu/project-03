import {
  ApplicationSource,
  EmailTemplateCategory,
  EmploymentType,
  Priority,
  SalaryPeriod,
  WorkMode,
} from './models';

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const PRIORITY_OPTIONS: Option<Priority>[] = [
  { value: 'LOW', label: 'Basse' },
  { value: 'MEDIUM', label: 'Moyenne' },
  { value: 'HIGH', label: 'Haute' },
];

export const WORK_MODE_OPTIONS: Option<WorkMode>[] = [
  { value: 'ON_SITE', label: 'Sur site' },
  { value: 'HYBRID', label: 'Hybride' },
  { value: 'REMOTE', label: 'Télétravail' },
];

export const EMPLOYMENT_TYPE_OPTIONS: Option<EmploymentType>[] = [
  { value: 'FULL_TIME', label: 'Temps plein' },
  { value: 'PART_TIME', label: 'Temps partiel' },
  { value: 'CONTRACT', label: 'CDD' },
  { value: 'INTERNSHIP', label: 'Stage' },
  { value: 'APPRENTICESHIP', label: 'Alternance' },
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'TEMPORARY', label: 'Intérim' },
];

export const SOURCE_OPTIONS: Option<ApplicationSource>[] = [
  { value: 'JOB_BOARD', label: "Site d'emploi" },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'COMPANY_WEBSITE', label: 'Site entreprise' },
  { value: 'REFERRAL', label: 'Cooptation' },
  { value: 'RECRUITER', label: 'Recruteur' },
  { value: 'CAREER_FAIR', label: 'Salon / forum' },
  { value: 'SPONTANEOUS', label: 'Candidature spontanée' },
  { value: 'OTHER', label: 'Autre' },
];

export const SALARY_PERIOD_OPTIONS: Option<SalaryPeriod>[] = [
  { value: 'HOUR', label: '/ heure' },
  { value: 'DAY', label: '/ jour' },
  { value: 'MONTH', label: '/ mois' },
  { value: 'YEAR', label: '/ an' },
];

export const EMAIL_TEMPLATE_CATEGORY_OPTIONS: Option<EmailTemplateCategory>[] = [
  { value: 'FOLLOW_UP', label: 'Relance' },
  { value: 'THANK_YOU', label: 'Remerciement' },
  { value: 'COLD_OUTREACH', label: 'Candidature spontanée' },
  { value: 'OFFER_NEGOTIATION', label: "Négociation d'offre" },
  { value: 'WITHDRAWAL', label: 'Retrait de candidature' },
  { value: 'OTHER', label: 'Autre' },
];

/** Resolve the French label for an enum value, or '' when unset/unknown. */
export function labelOf<T extends string>(
  options: Option<T>[],
  value: T | null | undefined,
): string {
  return options.find((o) => o.value === value)?.label ?? '';
}

// Interview enums — read-only display for now (no interview UI yet).
export const INTERVIEW_TYPE_LABEL: Record<string, string> = {
  PHONE_SCREEN: 'Préqualif téléphonique',
  HR: 'RH',
  TECHNICAL: 'Technique',
  TAKE_HOME: 'Test à la maison',
  SYSTEM_DESIGN: 'System design',
  BEHAVIORAL: 'Comportemental',
  ONSITE: 'Sur site',
  PANEL: 'Panel',
  FINAL: 'Final',
  OTHER: 'Autre',
};

export const INTERVIEW_OUTCOME_LABEL: Record<string, string> = {
  PENDING: 'À venir',
  PASSED: 'Réussi',
  FAILED: 'Échoué',
  CANCELED: 'Annulé',
  NO_SHOW: 'Absence',
};

// ---- Achievements ---------------------------------------------------------
// Achievement.code is the only signal we have client-side (the catalog itself
// stays generic server-side) — group and rank purely from its wording.

export type AchievementCategory =
  | 'Candidatures'
  | 'Entretiens'
  | 'Offres'
  | 'Discipline'
  | 'Niveau';

export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategory[] = [
  'Candidatures',
  'Entretiens',
  'Offres',
  'Discipline',
  'Niveau',
];

export function achievementCategory(code: string): AchievementCategory {
  if (code.includes('APPLICATION')) return 'Candidatures';
  if (code.includes('INTERVIEW')) return 'Entretiens';
  if (code.includes('OFFER') || code.includes('ACCEPTED')) return 'Offres';
  if (code.includes('STREAK')) return 'Discipline';
  return 'Niveau';
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

/** Tier numeral for the Nth achievement (ascending threshold) within a category. */
export function toRoman(n: number): string {
  return ROMAN_NUMERALS[n - 1] ?? String(n);
}
