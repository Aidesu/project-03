import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { User, UserSettings } from './models';

export interface UpdateAccountInput {
  name?: string;
  email?: string;
  currentPassword?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * Every field is optional, matching UpdateSettingsDto: the endpoint upserts and
 * merges, so the language switcher can send `{ locale }` alone without having
 * to read back and resend the rest of the settings.
 */
export interface UpdateSettingsInput {
  locale?: string;
  timezone?: string;
  weeklyApplicationGoal?: number;
  emailRemindersEnabled?: boolean;
}

export interface DeleteAccountInput {
  currentPassword: string;
  confirmation: string;
}

interface UserResponse {
  user: User;
}

/** One signed-in device. `id` is the rotation family, not a single token row. */
export interface ActiveSession {
  id: string;
  ip: string | null;
  userAgent: string | null;
  signedInAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/users/me';
  // Sessions live under /api/auth, not /api/users/me: the refresh cookie is
  // path-scoped there, and the server needs it to tell this device apart.
  private readonly sessionsBase = '/api/auth/sessions';

  updateAccount(input: UpdateAccountInput): Observable<UserResponse> {
    return this.http.patch<UserResponse>(this.base, input);
  }

  changePassword(input: ChangePasswordInput): Observable<void> {
    return this.http.post<void>(`${this.base}/password`, input);
  }

  uploadAvatar(file: File): Observable<UserResponse> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http.post<UserResponse>(`${this.base}/avatar`, formData);
  }

  removeAvatar(): Observable<UserResponse> {
    return this.http.delete<UserResponse>(`${this.base}/avatar`);
  }

  getSettings(): Observable<UserSettings> {
    return this.http.get<UserSettings>(`${this.base}/settings`);
  }

  updateSettings(input: UpdateSettingsInput): Observable<UserSettings> {
    return this.http.put<UserSettings>(`${this.base}/settings`, input);
  }

  deleteAccount(input: DeleteAccountInput): Observable<void> {
    return this.http.post<void>(`${this.base}/delete`, input);
  }

  /**
   * GDPR export. Read as a blob rather than parsed JSON: the file is handed
   * straight to the browser, and re-serializing it here would only risk the
   * download differing from what the server actually produced.
   */
  exportData(): Observable<Blob> {
    return this.http.get(`${this.base}/export`, { responseType: 'blob' });
  }

  listSessions(): Observable<{ sessions: ActiveSession[] }> {
    return this.http.get<{ sessions: ActiveSession[] }>(this.sessionsBase);
  }

  revokeSession(id: string): Observable<void> {
    return this.http.delete<void>(`${this.sessionsBase}/${id}`);
  }

  /** Signs out every other device; this one stays connected. */
  revokeOtherSessions(): Observable<{ revoked: number }> {
    return this.http.delete<{ revoked: number }>(this.sessionsBase);
  }
}
