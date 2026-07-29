import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Achievement, GamificationProfile } from './models';

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private readonly http = inject(HttpClient);

  getProfile(): Observable<GamificationProfile> {
    return this.http.get<GamificationProfile>('/api/gamification/me');
  }

  getAchievements(): Observable<Achievement[]> {
    return this.http.get<Achievement[]>('/api/gamification/achievements');
  }
}
