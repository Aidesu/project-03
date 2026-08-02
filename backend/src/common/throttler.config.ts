import { ExecutionContext } from '@nestjs/common';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Credential-verification routes. The per-IP limits on these live on the
 * handlers (`@Throttle`); the `account` throttler below adds an orthogonal
 * per-identity limit so a botnet spread over thousands of IPs still can't
 * grind a single account — per-IP limiting alone never sees that attack.
 */
const ACCOUNT_THROTTLED_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
]);

const ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_ATTEMPTS = 10;

function emailFromBody(req: Request): string | null {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null) return null;
  const email = (body as { email?: unknown }).email;
  // Same normalization the DTOs apply, so "A@B.com" and "a@b.com" share a
  // bucket instead of giving an attacker a free multiplier by changing case.
  return typeof email === 'string' ? email.trim().toLowerCase() : null;
}

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    // Baseline per-IP ceiling for the whole API.
    { name: 'default', ttl: 60_000, limit: 120 },
    {
      name: 'account',
      ttl: ACCOUNT_WINDOW_MS,
      limit: ACCOUNT_ATTEMPTS,
      blockDuration: ACCOUNT_WINDOW_MS,
      // Skipped everywhere else so we don't keep a second counter per request.
      skipIf: (ctx: ExecutionContext) =>
        !ACCOUNT_THROTTLED_PATHS.has(
          ctx.switchToHttp().getRequest<Request>().path,
        ),
      // Fall back to the IP when no email was supplied: an unkeyable attempt
      // must still be counted, never waved through.
      getTracker: (req: Record<string, unknown>) => {
        const request = req as unknown as Request;
        const email = emailFromBody(request);
        return email
          ? `account:${email}`
          : `account-ip:${request.ip ?? 'unknown'}`;
      },
    },
  ],
};
