import type { Request } from 'express';
import type { AccessTokenPayload } from './token.service';

// Auth cookies (httpOnly, Secure in prod, SameSite=strict).
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
// Refresh cookie is scoped so it only travels to the auth routes.
export const REFRESH_COOKIE_PATH = '/api/auth';

// CSRF double-submit cookie/header — names match Angular's built-in XSRF support.
export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'x-xsrf-token';

/** Express request after the JwtAuthGuard has attached the decoded access token. */
export type AuthenticatedRequest = Request & { user?: AccessTokenPayload };
