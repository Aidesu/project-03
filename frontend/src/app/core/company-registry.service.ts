import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CompanyRegistryEntry, Paginated } from './models';

export interface CompanyRegistryQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  departmentCode?: string;
  regionCode?: string;
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

/**
 * Shared, read-only reference data (SIRENE/INSEE) — not scoped to the
 * signed-in user. Every authenticated user can search it; there is no
 * create/update/delete here by design (see CompanyRegistryController).
 */
@Injectable({ providedIn: 'root' })
export class CompanyRegistryService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/company-registry';

  search(
    query: CompanyRegistryQuery = {},
  ): Observable<Paginated<CompanyRegistryEntry>> {
    return this.http.get<Paginated<CompanyRegistryEntry>>(
      `${this.base}/search`,
      { params: toParams(query) },
    );
  }
}
