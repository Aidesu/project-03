import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { STATUS_BADGE, STATUS_KEYS } from '../core/application-status';
import { avatarColor } from '../core/avatar-color';
import { CompaniesService } from '../core/companies.service';
import { ContactsService } from '../core/contacts.service';
import { COMPANY_SIZE_KEYS, labelOf } from '../core/enums';
import { externalUrl, urlLabel } from '../core/external-url';
import { I18nService } from '../core/i18n';
import { CompanyDetail, Contact } from '../core/models';
import { CompanyForm } from '../shared/company-form/company-form';
import { ContactForm } from '../shared/contact-form/contact-form';

@Component({
  selector: 'app-company-detail',
  imports: [RouterLink, CompanyForm, ContactForm],
  templateUrl: './company-detail.html',
})
export class CompanyDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly companiesApi = inject(CompaniesService);
  private readonly contactsApi = inject(ContactsService);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly date = this.i18n.date;
  readonly statusBadge = STATUS_BADGE;
  readonly statusKeys = STATUS_KEYS;

  readonly detail = signal<CompanyDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly deleting = signal(false);
  readonly showEditForm = signal(false);
  readonly showContactForm = signal(false);
  readonly editingContact = signal<Contact | null>(null);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.companiesApi.getOne(this.id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      // Covers both "does not exist" and "belongs to someone else" — the API
      // answers 404 in both cases, on purpose.
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

  contactName(c: Contact): string {
    return [c.firstName, c.lastName].filter(Boolean).join(' ');
  }

  sizeLabel(size: string | null): string {
    return size ? labelOf(COMPANY_SIZE_KEYS, size, this.t) || size : '';
  }

  websiteHref(website: string | null): string | null {
    return externalUrl(website);
  }

  websiteLabel(website: string | null): string | null {
    return urlLabel(website);
  }

  onCompanySaved(): void {
    this.showEditForm.set(false);
    this.load();
  }

  openNewContact(): void {
    this.editingContact.set(null);
    this.showContactForm.set(true);
  }

  openEditContact(c: Contact): void {
    this.editingContact.set(c);
    this.showContactForm.set(true);
  }

  onContactSaved(): void {
    this.showContactForm.set(false);
    this.editingContact.set(null);
    this.load();
  }

  removeContact(c: Contact): void {
    if (
      !confirm(this.t('network.confirmDeleteContact', { name: this.contactName(c) }))
    ) {
      return;
    }
    this.contactsApi.remove(c.id).subscribe({ next: () => this.load() });
  }

  remove(): void {
    const d = this.detail();
    if (!d || this.deleting()) return;
    if (
      !confirm(
        this.t('companyDetail.confirmDelete', {
          name: d.name,
          applications: d._count.applications,
          contacts: d._count.contacts,
        }),
      )
    ) {
      return;
    }
    this.deleting.set(true);
    this.companiesApi.remove(d.id).subscribe({
      next: () => void this.router.navigateByUrl('/network'),
      error: () => this.deleting.set(false),
    });
  }
}
