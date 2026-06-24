import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface HealthResponse {
  status: string;
  timestamp: string;
}

/**
 * Thin wrapper around HttpClient for talking to the NestJS backend.
 * Requests use the `/api` prefix, which is proxied to the backend in dev
 * (see proxy.conf.json).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.baseUrl}/health`);
  }
}
