import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApplicationDefaultsService } from './application-defaults.service';
import { I18nService } from './i18n';
import { User } from './models';

interface AuthResponse {
  user: User;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

/** Kept in step with PASSWORD_RESET_TTL_MINUTES on the server. */
export const PASSWORD_RESET_TTL_MINUTES = 30;

/**
 * Auth state + flows against the cookie-based backend.
 *
 * Tokens live in httpOnly cookies we never touch; the only client-visible
 * state is the current `user`. CSRF uses Angular's built-in XSRF support, so
 * we just need the XSRF-TOKEN cookie to exist before any mutation — hence the
 * `ensureCsrf()` call on startup.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly applicationDefaults = inject(ApplicationDefaultsService);
  private readonly base = '/api/auth';

  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  /**
   * Dedupes concurrent refresh attempts: if several requests 401 at once
   * (e.g. a page firing multiple API calls right as the access token
   * expires), they must all await the *same* refresh call. The refresh
   * token rotates on use, so firing it twice in parallel would make the
   * second call replay an already-revoked token — triggering reuse
   * detection and burning the whole session family.
   */
  private refreshInFlight: Promise<boolean> | null = null;

  /** Runs once at app start: seed the CSRF cookie and restore any session. */
  async restoreSession(): Promise<void> {
    await this.ensureCsrf();
    try {
      const { user } = await firstValueFrom(
        this.http.get<AuthResponse>(`${this.base}/me`),
      );
      this.adoptUser(user);
    } catch {
      this._user.set(null);
    }
  }

  /**
   * Refreshes the access token via the httpOnly refresh cookie. Safe to call
   * concurrently — all callers share the single in-flight request. Used by
   * the auth-refresh interceptor to transparently recover from an expired
   * (15m) access token instead of surfacing a 401 to the user.
   */
  refreshSession(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  /** Clears local session state without hitting the backend (used after a failed refresh). */
  clearSession(): void {
    this._user.set(null);
  }

  /** Syncs the local user signal after a profile mutation, without a full `/auth/me` refetch. */
  updateUser(user: User): void {
    this.adoptUser(user);
  }

  /**
   * Single entry point for "a session now belongs to this user": stores them
   * and switches the UI to their language and time zone. Every response that
   * carries a user goes through here, so a preference changed on another device
   * takes effect on the next refresh.
   */
  private adoptUser(user: User): void {
    this._user.set(user);
    this.i18n.applySettings(user);
  }

  private async performRefresh(): Promise<boolean> {
    try {
      const { user } = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.base}/refresh`, {}),
      );
      this.adoptUser(user);
      return true;
    } catch {
      this._user.set(null);
      return false;
    }
  }

  async login(email: string, password: string): Promise<User> {
    const { user } = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.base}/login`, { email, password }),
    );
    this.adoptUser(user);
    return user;
  }

  async register(input: RegisterInput): Promise<User> {
    const { user } = await firstValueFrom(
      // The active language travels with the signup: there is no settings row
      // yet, so it is the only clue the verification e-mail has.
      this.http.post<AuthResponse>(`${this.base}/register`, {
        ...input,
        locale: this.i18n.locale(),
      }),
    );
    this.adoptUser(user);
    return user;
  }

  /**
   * Ask for a reset link. Resolves the same way whether or not the address has
   * an account — the server answers 204 either way, on purpose.
   */
  async requestPasswordReset(email: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/password/forgot`, { email }),
    );
  }

  /** Redeem a reset link. Every session, including this browser's, is now gone. */
  async resetPassword(token: string, password: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/password/reset`, { token, password }),
    );
    this._user.set(null);
  }

  /** Redeem a verification link. Refreshes the local user when one is signed in. */
  async verifyEmail(token: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/email/verify`, { token }));
    if (this._user()) await this.restoreSession();
  }

  async resendEmailVerification(): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/email/verify/resend`, {}),
    );
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.base}/logout`, {}));
    } finally {
      this._user.set(null);
      // Drop the departing user's zone; their chosen language is kept so the
      // login screen stays in the language they were just reading.
      this.i18n.reset();
      // Form defaults describe how *that* user applies to jobs. On a shared
      // machine the next person must not inherit them.
      this.applicationDefaults.clear();
    }
  }

  /** Ask the backend to (re)issue the XSRF-TOKEN cookie. Best-effort. */
  private async ensureCsrf(): Promise<void> {
    try {
      await firstValueFrom(this.http.get(`${this.base}/csrf`));
    } catch {
      // Non-fatal: a mutation will surface the error if the token is missing.
    }
  }
}
