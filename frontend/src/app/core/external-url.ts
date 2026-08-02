/**
 * Makes a user-entered URL safe to drop into an `href`.
 *
 * Users type "acme.com" as often as "https://acme.com", and a bare host in an
 * href resolves as a relative path. Anything that is not http(s) is refused
 * outright rather than rewritten — `javascript:` and `data:` must never reach
 * a link, whoever typed them.
 */
export function externalUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null; // some other scheme
  return `https://${trimmed}`;
}

/** Short display label for a URL: the host, without protocol or `www.`. */
export function urlLabel(raw: string | null | undefined): string | null {
  const href = externalUrl(raw);
  if (!href) return null;
  try {
    return new URL(href).host.replace(/^www\./i, '');
  } catch {
    return raw?.trim() || null;
  }
}
