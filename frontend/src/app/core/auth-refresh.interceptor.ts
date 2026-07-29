import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

// Auth endpoints must never trigger a nested refresh attempt on their own 401s.
const AUTH_ENDPOINTS = [
  '/api/auth/refresh',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/csrf',
];

/**
 * The access token cookie expires after 15 minutes. Without this
 * interceptor, any request made after that silently fails with 401 and
 * the app looks "logged out" mid-session. On a 401, transparently refresh
 * the access token (via the httpOnly refresh cookie, deduped through
 * AuthService.refreshSession) and retry the original request once. Only
 * on an actual failed refresh do we clear the session and bounce to login.
 */
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (AUTH_ENDPOINTS.some((path) => req.url.includes(path))) {
    return next(req);
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      return from(auth.refreshSession()).pipe(
        switchMap((refreshed) => {
          if (refreshed) return next(req);
          auth.clearSession();
          void router.navigate(['/login']);
          return throwError(() => err);
        }),
      );
    }),
  );
};
