import { Injectable } from '@nestjs/common';
import { doubleCsrf, type DoubleCsrfProtection } from 'csrf-csrf';
import type { Request, Response } from 'express';
import { CSRF_COOKIE, CSRF_HEADER } from './auth.constants';

/**
 * CSRF protection via the double-submit-cookie pattern (`csrf-csrf`), aligned
 * with Angular's built-in XSRF convention (XSRF-TOKEN cookie / x-xsrf-token
 * header) so the SPA handles it automatically.
 *
 * SameSite=strict on the auth cookies is the primary CSRF defense; this token
 * is defense-in-depth, hence a stateless (constant) session identifier.
 */
@Injectable()
export class CsrfService {
  private readonly utils = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET as string,
    getSessionIdentifier: () => '',
    cookieName: CSRF_COOKIE,
    cookieOptions: {
      sameSite: 'strict',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false, // must be readable by the Angular client
    },
    getCsrfTokenFromRequest: (req: Request) =>
      req.headers[CSRF_HEADER] as string | undefined,
  });

  /** Express middleware that validates the token on mutating requests. */
  get protection(): DoubleCsrfProtection {
    return this.utils.doubleCsrfProtection;
  }

  /** Issue a token and set the XSRF-TOKEN cookie. */
  issueToken(req: Request, res: Response): string {
    return this.utils.generateCsrfToken(req, res);
  }
}
