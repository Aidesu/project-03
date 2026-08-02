/**
 * Deterministic Tailwind color pair for a company-initial avatar, keyed by name.
 * Each entry carries its own dark pair for the same reason the status badges do:
 * a `-100` fill would glare on a dark page instead of tinting it.
 */
const AVATAR_PALETTE = [
  'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
] as const;

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}
