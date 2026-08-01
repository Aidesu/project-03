/** "★★★★☆"-style rendering of a 1-5 average rating; "—" when there's no data yet. */
export function starDisplay(avg: number | null): string {
  if (avg == null) return '—';
  const rounded = Math.min(5, Math.max(0, Math.round(avg)));
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}
