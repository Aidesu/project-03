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

export interface UpdateSettingsInput {
  locale: string;
  timezone: string;
  weeklyApplicationGoal: number;
  emailRemindersEnabled: boolean;
}

export interface DeleteAccountInput {
  currentPassword: string;
  confirmation: string;
}

interface UserResponse {
  user: User;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/users/me';

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
}
