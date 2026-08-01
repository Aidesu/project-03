import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { avatarColor } from '../core/avatar-color';
import { CompaniesService } from '../core/companies.service';
import { DiscoverService } from '../core/discover.service';
import { DiscoverCompany, Paginated } from '../core/models';
import { starDisplay } from '../core/rating-display';

@Component({
  selector: 'app-discover',
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './discover.html',
})
export class Discover {
  private readonly discover = inject(DiscoverService);
  private readonly companies = inject(CompaniesService);
  private readonly router = inject(Router);

  readonly data = signal<Paginated<DiscoverCompany> | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  page = 1;
  search = '';

  readonly showAddForm = signal(false);
  readonly adding = signal(false);
  readonly addError = signal<string | null>(null);
  newName = '';
  newWebsite = '';
  newIndustry = '';
  newLocation = '';

  readonly rangeLabel = computed(() => {
    const d = this.data();
    if (!d || d.total === 0) return '';
    const from = (d.page - 1) * d.pageSize + 1;
    const to = Math.min(d.page * d.pageSize, d.total);
    return `${from}–${to} sur ${d.total}`;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.discover
      .list({ page: this.page, search: this.search.trim() || undefined })
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  /** Reset to the first page whenever a filter changes. */
  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  goTo(page: number): void {
    this.page = page;
    this.load();
  }

  avatarColor(name: string): string {
    return avatarColor(name);
  }

  starDisplay(avg: number | null): string {
    return starDisplay(avg);
  }

  toggleAddForm(): void {
    this.showAddForm.set(!this.showAddForm());
    this.addError.set(null);
  }

  /**
   * Adds a company straight to the directory — no application required.
   * Creates a private Company (owned by the current user, no JobApplication
   * attached); CompaniesService links it into the shared directory as a
   * side effect, which is what actually makes it show up here for everyone.
   */
  submitNewCompany(): void {
    const name = this.newName.trim();
    if (!name || this.adding()) return;

    this.adding.set(true);
    this.addError.set(null);
    this.companies
      .create({
        name,
        website: this.newWebsite.trim() || undefined,
        industry: this.newIndustry.trim() || undefined,
        location: this.newLocation.trim() || undefined,
      })
      .subscribe({
        next: (created) => {
          this.adding.set(false);
          if (created.directoryCompanyId) {
            this.router.navigate(['/discover', created.directoryCompanyId]);
          } else {
            this.showAddForm.set(false);
            this.load();
          }
        },
        error: (err: unknown) => {
          this.adding.set(false);
          this.addError.set(
            err instanceof HttpErrorResponse && err.status === 400
              ? "Vérifie le nom et l'URL du site."
              : "Impossible d'ajouter cette entreprise pour l'instant.",
          );
        },
      });
  }
}
