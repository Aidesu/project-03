import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { avatarColor } from '../core/avatar-color';
import { ContactsService } from '../core/contacts.service';
import { ConfirmService } from '../core/confirm.service';
import {
  INTERVIEW_OUTCOME_KEYS,
  INTERVIEW_TYPE_KEYS,
  labelOrRaw,
} from '../core/enums';
import { externalUrl, urlLabel } from '../core/external-url';
import { I18nService } from '../core/i18n';
import { ContactDetail } from '../core/models';
import { ContactForm } from '../shared/contact-form/contact-form';

@Component({
  selector: 'app-contact-detail',
  imports: [RouterLink, ContactForm],
  templateUrl: './contact-detail.html',
})
export class ContactDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contactsApi = inject(ContactsService);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly dateTime = this.i18n.dateTime;

  readonly detail = signal<ContactDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly deleting = signal(false);
  readonly showEditForm = signal(false);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.contactsApi.getOne(this.id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  avatarColor(name: string): string {
    return avatarColor(name);
  }

  initial(name: string): string {
    return (name.trim().slice(0, 1) || '?').toUpperCase();
  }

  get fullName(): string {
    const d = this.detail();
    if (!d) return '';
    return [d.firstName, d.lastName].filter(Boolean).join(' ');
  }

  interviewTypeLabel(value: string): string {
    return labelOrRaw(INTERVIEW_TYPE_KEYS, value, this.t);
  }

  interviewOutcomeLabel(value: string): string {
    return labelOrRaw(INTERVIEW_OUTCOME_KEYS, value, this.t);
  }

  linkedinHref(url: string | null): string | null {
    return externalUrl(url);
  }

  linkedinLabel(url: string | null): string | null {
    return urlLabel(url);
  }

  onSaved(): void {
    this.showEditForm.set(false);
    this.load();
  }

  async remove(): Promise<void> {
    const d = this.detail();
    if (!d || this.deleting()) return;
    const confirmed = await this.confirm.ask({
      title: 'network.confirmDeleteContact.title',
      message: 'network.confirmDeleteContact.body',
      params: { name: this.fullName },
      confirmLabel: 'common.delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.deleting.set(true);
    this.contactsApi.remove(d.id).subscribe({
      next: () => void this.router.navigateByUrl('/network?tab=contacts'),
      error: () => this.deleting.set(false),
    });
  }
}
