import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { avatarColor } from '../core/avatar-color';
import { CompaniesService } from '../core/companies.service';
import { ContactsService } from '../core/contacts.service';
import { I18nService } from '../core/i18n';
import { CompanyListItem, Contact, Paginated } from '../core/models';
import { CompanyForm } from '../shared/company-form/company-form';
import { ContactForm } from '../shared/contact-form/contact-form';

export type NetworkTab = 'companies' | 'contacts';

@Component({
  selector: 'app-network',
  imports: [FormsModule, RouterLink, CompanyForm, ContactForm],
  templateUrl: './network.html',
})
export class Network {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly companiesApi = inject(CompaniesService);
  private readonly contactsApi = inject(ContactsService);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly tab = signal<NetworkTab>('companies');

  readonly companies = signal<Paginated<CompanyListItem> | null>(null);
  readonly contacts = signal<Paginated<Contact> | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly deletingId = signal<string | null>(null);

  // Each tab keeps its own search/page so switching back restores the view.
  companySearch = '';
  companyPage = 1;
  contactSearch = '';
  contactPage = 1;

  readonly showCompanyForm = signal(false);
  readonly showContactForm = signal(false);

  readonly rangeLabel = computed(() => {
    const d = this.tab() === 'companies' ? this.companies() : this.contacts();
    if (!d || d.total === 0) return '';
    const from = (d.page - 1) * d.pageSize + 1;
    const to = Math.min(d.page * d.pageSize, d.total);
    return this.t('common.range', {
      from: this.i18n.number(from),
      to: this.i18n.number(to),
      total: this.i18n.number(d.total),
    });
  });

  constructor() {
    const requested = this.route.snapshot.queryParamMap.get('tab');
    if (requested === 'contacts') this.tab.set('contacts');
    this.load();
  }

  switchTab(tab: NetworkTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    // Keep the tab in the URL so a refresh or a shared link lands on it.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      replaceUrl: true,
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);

    const request: Observable<Paginated<CompanyListItem> | Paginated<Contact>> =
      this.tab() === 'companies'
        ? this.companiesApi.list({
            page: this.companyPage,
            search: this.companySearch.trim() || undefined,
          })
        : this.contactsApi.list({
            page: this.contactPage,
            search: this.contactSearch.trim() || undefined,
          });

    request.subscribe({
      next: (page) => {
        if (this.tab() === 'companies') {
          this.companies.set(page as Paginated<CompanyListItem>);
        } else {
          this.contacts.set(page as Paginated<Contact>);
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Reset to the first page whenever the search changes. */
  applySearch(): void {
    if (this.tab() === 'companies') this.companyPage = 1;
    else this.contactPage = 1;
    this.load();
  }

  goTo(page: number): void {
    if (this.tab() === 'companies') this.companyPage = page;
    else this.contactPage = page;
    this.load();
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

  onSaved(): void {
    this.showCompanyForm.set(false);
    this.showContactForm.set(false);
    this.load();
  }

  removeCompany(c: CompanyListItem): void {
    if (this.deletingId()) return;
    if (!confirm(this.t('network.confirmDeleteCompany', { name: c.name }))) return;
    this.deletingId.set(c.id);
    this.companiesApi.remove(c.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.load();
      },
      error: () => this.deletingId.set(null),
    });
  }

  removeContact(c: Contact): void {
    if (this.deletingId()) return;
    if (
      !confirm(this.t('network.confirmDeleteContact', { name: this.contactName(c) }))
    ) {
      return;
    }
    this.deletingId.set(c.id);
    this.contactsApi.remove(c.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.load();
      },
      error: () => this.deletingId.set(null),
    });
  }
}
