import type { CookieOptions, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
} from './auth.constants';

// Cookie max-ages mirror the token TTLs. The JWT's own `exp` and the stored
// session's `expiresAt` remain the real source of truth for expiry.
const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const refreshMaxAgeMs = () =>
  Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7) * 24 * 60 * 60 * 1000;

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  };
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...baseOptions(),
    path: '/',
    maxAge: ACCESS_MAX_AGE_MS,
  });
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...baseOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshMaxAgeMs(),
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseOptions(), path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...baseOptions(),
    path: REFRESH_COOKIE_PATH,
  });
}
