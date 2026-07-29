import { ApplicationStatus } from './models';

interface StatusMeta {
  label: string;
  /** Tailwind classes for a badge (bg + text). */
  badge: string;
}

/** French labels + badge styles for each pipeline status. */
export const STATUS_META: Record<ApplicationStatus, StatusMeta> = {
  WISHLIST: { label: 'À tenter', badge: 'bg-slate-100 text-slate-600' },
  DRAFT: { label: 'Brouillon', badge: 'bg-slate-100 text-slate-600' },
  APPLIED: { label: 'Candidaté', badge: 'bg-brand-100 text-brand-700' },
  SCREENING: { label: 'Préqualif', badge: 'bg-sky-100 text-sky-700' },
  INTERVIEW: { label: 'Entretien', badge: 'bg-indigo-100 text-indigo-700' },
  TECHNICAL_TEST: { label: 'Test technique', badge: 'bg-violet-100 text-violet-700' },
  OFFER: { label: 'Offre', badge: 'bg-amber-100 text-amber-700' },
  ACCEPTED: { label: 'Acceptée', badge: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Refusée', badge: 'bg-rose-100 text-rose-700' },
  WITHDRAWN: { label: 'Retirée', badge: 'bg-slate-100 text-slate-500' },
  GHOSTED: { label: 'Sans réponse', badge: 'bg-slate-100 text-slate-500' },
};

export const ALL_STATUSES = Object.keys(STATUS_META) as ApplicationStatus[];
