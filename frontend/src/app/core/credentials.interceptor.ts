import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Send cookies on every request so the httpOnly auth/refresh cookies travel
 * with API calls. Angular's built-in XSRF interceptor (configured in
 * app.config) adds the `x-xsrf-token` header from the XSRF-TOKEN cookie.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));
