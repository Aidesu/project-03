import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { User } from './models';

interface AuthResponse {
  user: User;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

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
      this._user.set(user);
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
    this._user.set(user);
  }

  private async performRefresh(): Promise<boolean> {
    try {
      const { user } = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.base}/refresh`, {}),
      );
      this._user.set(user);
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
    this._user.set(user);
    return user;
  }

  async register(input: RegisterInput): Promise<User> {
    const { user } = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.base}/register`, input),
    );
    this._user.set(user);
    return user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.base}/logout`, {}));
    } finally {
      this._user.set(null);
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
