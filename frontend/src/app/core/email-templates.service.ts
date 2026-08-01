import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EmailTemplate, EmailTemplateCategory } from './models';

export interface EmailTemplateInput {
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  body: string;
}

@Injectable({ providedIn: 'root' })
export class EmailTemplatesService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/email-templates';

  list(): Observable<EmailTemplate[]> {
    return this.http.get<EmailTemplate[]>(this.base);
  }

  create(input: EmailTemplateInput): Observable<EmailTemplate> {
    return this.http.post<EmailTemplate>(this.base, input);
  }

  update(id: string, input: EmailTemplateInput): Observable<EmailTemplate> {
    return this.http.patch<EmailTemplate>(`${this.base}/${id}`, input);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
