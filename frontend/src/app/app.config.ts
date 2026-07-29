import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authRefreshInterceptor } from './core/auth-refresh.interceptor';
import { AuthService } from './core/auth.service';
import { credentialsInterceptor } from './core/credentials.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      // Match the backend's double-submit CSRF cookie/header convention.
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'x-xsrf-token',
      }),
      withInterceptors([credentialsInterceptor, authRefreshInterceptor]),
    ),
    // Seed the CSRF cookie and restore any existing session before routing.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
