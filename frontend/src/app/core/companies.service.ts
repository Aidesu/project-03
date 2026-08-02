import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CompanyDetail, CompanyListItem, Paginated } from './models';

export interface CompanyQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Payload for `POST /api/companies` and `PATCH /api/companies/:id`.
 * Only `name` is required; the backend rejects unknown fields.
 *
 * `null` means "clear this field" — never send `''`, which would fail the
 * server-side `@IsUrl()` check on `website` instead of emptying the column.
 */
export interface CompanyInput {
  name: string;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  size?: string | null;
  notes?: string | null;
}

/** Drops empty/undefined values so they never reach the query string. */
function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/companies';

  list(query: CompanyQuery = {}): Observable<Paginated<CompanyListItem>> {
    return this.http.get<Paginated<CompanyListItem>>(this.base, {
      params: toParams(query),
    });
  }

  getOne(id: string): Observable<CompanyDetail> {
    return this.http.get<CompanyDetail>(`${this.base}/${id}`);
  }

  create(input: CompanyInput): Observable<CompanyListItem> {
    return this.http.post<CompanyListItem>(this.base, input);
  }

  update(id: string, input: CompanyInput): Observable<CompanyListItem> {
    return this.http.patch<CompanyListItem>(`${this.base}/${id}`, input);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
