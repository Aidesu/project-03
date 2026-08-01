import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CompanyReviewRef, DiscoverCompany, MyReviewContext, Paginated } from './models';

export interface DiscoverQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface SubmitReviewInput {
  rating: number;
  didRespond: boolean;
}

@Injectable({ providedIn: 'root' })
export class DiscoverService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/discover';

  list(query: DiscoverQuery = {}): Observable<Paginated<DiscoverCompany>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<Paginated<DiscoverCompany>>(this.base, { params });
  }

  getOne(id: string): Observable<DiscoverCompany> {
    return this.http.get<DiscoverCompany>(`${this.base}/${id}`);
  }

  getMyReview(id: string): Observable<MyReviewContext> {
    return this.http.get<MyReviewContext>(`${this.base}/${id}/my-review`);
  }

  submitReview(id: string, input: SubmitReviewInput): Observable<CompanyReviewRef> {
    return this.http.post<CompanyReviewRef>(`${this.base}/${id}/reviews`, input);
  }
}
