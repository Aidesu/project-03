import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApplicationDetail,
  ApplicationListItem,
  ApplicationSource,
  ApplicationStatus,
  DailyApplicationStat,
  EmploymentType,
  Paginated,
  Priority,
  SalaryPeriod,
  WorkMode,
} from './models';

export interface ApplicationsQuery {
  page?: number;
  pageSize?: number;
  status?: ApplicationStatus;
  search?: string;
}

/**
 * Payload for `PATCH /api/applications/:id`. Nullable fields accept `null` to
 * clear them (the backend's `@IsOptional()` skips validation on null). `status`
 * is intentionally absent — change it via `changeStatus()`.
 */
export interface UpdateApplicationInput {
  position?: string;
  companyName?: string | null;
  location?: string | null;
  jobUrl?: string | null;
  priority?: Priority;
  workMode?: WorkMode | null;
  employmentType?: EmploymentType | null;
  source?: ApplicationSource | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  excitement?: number | null;
  deadlineAt?: string | null;
  notes?: string | null;
  isFavorite?: boolean;
  isArchived?: boolean;
}

/** Payload for `POST /api/applications` — only `position` is required. */
export interface CreateApplicationInput {
  position: string;
  companyName?: string;
  location?: string;
  jobUrl?: string;
  status?: ApplicationStatus;
  priority?: Priority;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  source?: ApplicationSource;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  excitement?: number;
  deadlineAt?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly http = inject(HttpClient);

  list(query: ApplicationsQuery = {}): Observable<Paginated<ApplicationListItem>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<Paginated<ApplicationListItem>>('/api/applications', {
      params,
    });
  }

  create(input: CreateApplicationInput): Observable<ApplicationListItem> {
    return this.http.post<ApplicationListItem>('/api/applications', input);
  }

  getOne(id: string): Observable<ApplicationDetail> {
    return this.http.get<ApplicationDetail>(`/api/applications/${id}`);
  }

  update(id: string, input: UpdateApplicationInput): Observable<ApplicationDetail> {
    return this.http.patch<ApplicationDetail>(`/api/applications/${id}`, input);
  }

  changeStatus(
    id: string,
    status: ApplicationStatus,
    note?: string,
  ): Observable<ApplicationDetail> {
    return this.http.patch<ApplicationDetail>(`/api/applications/${id}/status`, {
      status,
      ...(note ? { note } : {}),
    });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/applications/${id}`);
  }

  getDailyStats(days = 7): Observable<DailyApplicationStat[]> {
    return this.http.get<DailyApplicationStat[]>('/api/applications/stats/daily', {
      params: { days },
    });
  }
}
