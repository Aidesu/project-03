import { TranslationKey } from './i18n';
import { ApplicationStatus } from './models';

/**
 * Badge styling per pipeline status. The label lives in the translation
 * catalogue under `status.<VALUE>`; only what cannot be translated stays here.
 */
/**
 * Badge styling per pipeline status.
 *
 * The `dark:` pairs are spelled out rather than left to the theme's neutral
 * remap: a `-100` fill is a pale block, and pale blocks on a dark page read as
 * holes punched through it. After dark the hue becomes a translucent wash of
 * its own 500 with the text lifted to 300, so a badge tints the surface it sits
 * on instead of replacing it. The slate ones ride the ramp and need no pair.
 */
export const STATUS_BADGE: Record<ApplicationStatus, string> = {
  WISHLIST: 'bg-slate-100 text-slate-600',
  DRAFT: 'bg-slate-100 text-slate-600',
  APPLIED: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200',
  SCREENING: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  INTERVIEW: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  TECHNICAL_TEST:
    'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  OFFER: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  ACCEPTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  WITHDRAWN: 'bg-slate-100 text-slate-500',
  GHOSTED: 'bg-slate-100 text-slate-500',
};

export const STATUS_KEYS = {
  WISHLIST: 'status.WISHLIST',
  DRAFT: 'status.DRAFT',
  APPLIED: 'status.APPLIED',
  SCREENING: 'status.SCREENING',
  INTERVIEW: 'status.INTERVIEW',
  TECHNICAL_TEST: 'status.TECHNICAL_TEST',
  OFFER: 'status.OFFER',
  ACCEPTED: 'status.ACCEPTED',
  REJECTED: 'status.REJECTED',
  WITHDRAWN: 'status.WITHDRAWN',
  GHOSTED: 'status.GHOSTED',
} satisfies Record<ApplicationStatus, TranslationKey>;

export const ALL_STATUSES = Object.keys(STATUS_BADGE) as ApplicationStatus[];
