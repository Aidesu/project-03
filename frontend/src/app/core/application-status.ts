import { TranslationKey } from './i18n';
import { ApplicationStatus } from './models';

/**
 * Badge styling per pipeline status. The label lives in the translation
 * catalogue under `status.<VALUE>`; only what cannot be translated stays here.
 */
export const STATUS_BADGE: Record<ApplicationStatus, string> = {
  WISHLIST: 'bg-slate-100 text-slate-600',
  DRAFT: 'bg-slate-100 text-slate-600',
  APPLIED: 'bg-brand-100 text-brand-700',
  SCREENING: 'bg-sky-100 text-sky-700',
  INTERVIEW: 'bg-indigo-100 text-indigo-700',
  TECHNICAL_TEST: 'bg-violet-100 text-violet-700',
  OFFER: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
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
