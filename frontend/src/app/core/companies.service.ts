import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** Payload for `POST /api/companies` — only `name` is required. */
export interface CreateCompanyInput {
  name: string;
  website?: string;
  industry?: string;
  location?: string;
  size?: string;
}

/** Fields consumed after creating a company — not the full Company row. */
export interface CreatedCompanyRef {
  id: string;
  name: string;
  directoryCompanyId: string | null;
}

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/companies';

  create(input: CreateCompanyInput): Observable<CreatedCompanyRef> {
    return this.http.post<CreatedCompanyRef>(this.base, input);
  }
}
