import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Contact, ContactDetail, Paginated } from './models';

export interface ContactQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  companyId?: string;
  sortBy?: 'firstName' | 'lastName' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Payload for `POST /api/contacts` and `PATCH /api/contacts/:id`.
 * Only `firstName` is required; `companyId` must reference one of the
 * caller's own companies — the backend rejects anything else with a 400.
 *
 * `null` means "clear this field" (or unlink the company); never send `''`,
 * which would fail the server-side `@IsEmail()`/`@IsUrl()` checks.
 */
export interface ContactInput {
  firstName: string;
  lastName?: string | null;
  companyId?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
}

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
export class ContactsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/contacts';

  list(query: ContactQuery = {}): Observable<Paginated<Contact>> {
    return this.http.get<Paginated<Contact>>(this.base, {
      params: toParams(query),
    });
  }

  getOne(id: string): Observable<ContactDetail> {
    return this.http.get<ContactDetail>(`${this.base}/${id}`);
  }

  create(input: ContactInput): Observable<Contact> {
    return this.http.post<Contact>(this.base, input);
  }

  update(id: string, input: ContactInput): Observable<Contact> {
    return this.http.patch<Contact>(`${this.base}/${id}`, input);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
