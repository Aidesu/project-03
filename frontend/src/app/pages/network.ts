import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { avatarColor } from '../core/avatar-color';
import { CompaniesService } from '../core/companies.service';
import { CompanyRegistryService } from '../core/company-registry.service';
import { ConfirmService } from '../core/confirm.service';
import { ContactsService } from '../core/contacts.service';
import { I18nService } from '../core/i18n';
import {
  CompanyListItem,
  CompanyRegistryEntry,
  Contact,
  Paginated,
} from '../core/models';
import { CompanyForm } from '../shared/company-form/company-form';
import { ContactForm } from '../shared/contact-form/contact-form';

export type NetworkTab = 'companies' | 'contacts' | 'registry';

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
  private readonly registryApi = inject(CompanyRegistryService);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly tab = signal<NetworkTab>('companies');

  readonly companies = signal<Paginated<CompanyListItem> | null>(null);
  readonly contacts = signal<Paginated<Contact> | null>(null);
  readonly registry = signal<Paginated<CompanyRegistryEntry> | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly deletingId = signal<string | null>(null);

  // Each tab keeps its own search/page so switching back restores the view.
  companySearch = '';
  companyPage = 1;
  contactSearch = '';
  contactPage = 1;
  registrySearch = '';
  registryPage = 1;

  readonly showCompanyForm = signal(false);
  readonly showContactForm = signal(false);

  readonly rangeLabel = computed(() => {
    const d =
      this.tab() === 'companies'
        ? this.companies()
        : this.tab() === 'contacts'
          ? this.contacts()
          : this.registry();
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
    if (requested === 'contacts' || requested === 'registry') {
      this.tab.set(requested);
    }
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

    const tab = this.tab();
    const request: Observable<
      Paginated<CompanyListItem> | Paginated<Contact> | Paginated<CompanyRegistryEntry>
    > =
      tab === 'companies'
        ? this.companiesApi.list({
            page: this.companyPage,
            search: this.companySearch.trim() || undefined,
          })
        : tab === 'contacts'
          ? this.contactsApi.list({
              page: this.contactPage,
              search: this.contactSearch.trim() || undefined,
            })
          : this.registryApi.search({
              page: this.registryPage,
              q: this.registrySearch.trim() || undefined,
            });

    request.subscribe({
      next: (page) => {
        if (tab === 'companies') {
          this.companies.set(page as Paginated<CompanyListItem>);
        } else if (tab === 'contacts') {
          this.contacts.set(page as Paginated<Contact>);
        } else {
          this.registry.set(page as Paginated<CompanyRegistryEntry>);
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
    else if (this.tab() === 'contacts') this.contactPage = 1;
    else this.registryPage = 1;
    this.load();
  }

  goTo(page: number): void {
    if (this.tab() === 'companies') this.companyPage = page;
    else if (this.tab() === 'contacts') this.contactPage = page;
    else this.registryPage = page;
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

  registryLocation(e: CompanyRegistryEntry): string {
    return [e.postalCode, e.commune].filter(Boolean).join(' ');
  }

  onSaved(): void {
    this.showCompanyForm.set(false);
    this.showContactForm.set(false);
    this.load();
  }

  async removeCompany(c: CompanyListItem): Promise<void> {
    if (this.deletingId()) return;
    const confirmed = await this.confirm.ask({
      title: 'network.confirmDeleteCompany.title',
      message: 'network.confirmDeleteCompany.body',
      params: { name: c.name },
      confirmLabel: 'common.delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.deletingId.set(c.id);
    this.companiesApi.remove(c.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.load();
      },
      error: () => this.deletingId.set(null),
    });
  }

  async removeContact(c: Contact): Promise<void> {
    if (this.deletingId()) return;
    const confirmed = await this.confirm.ask({
      title: 'network.confirmDeleteContact.title',
      message: 'network.confirmDeleteContact.body',
      params: { name: this.contactName(c) },
      confirmLabel: 'common.delete',
      tone: 'danger',
    });
    if (!confirmed) return;
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
