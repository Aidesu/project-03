/** Two-letter avatar fallback from a name or email; `?` when nothing is available. */
export function initialsOf(source: string | null | undefined): string {
  const trimmed = source?.trim();
  return trimmed ? trimmed.slice(0, 2).toUpperCase() : '?';
}
