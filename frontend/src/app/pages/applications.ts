import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApplicationsService } from '../core/applications.service';
import { ALL_STATUSES, STATUS_BADGE, STATUS_KEYS } from '../core/application-status';
import { avatarColor } from '../core/avatar-color';
import { I18nService } from '../core/i18n';
import {
  ApplicationListItem,
  ApplicationStatus,
  Paginated,
} from '../core/models';
import {
  QuickApplicationForm,
  QuickApplicationResult,
} from '../shared/quick-application-form/quick-application-form';

@Component({
  selector: 'app-applications',
  imports: [FormsModule, QuickApplicationForm, RouterLink],
  templateUrl: './applications.html',
})
export class Applications {
  private readonly applications = inject(ApplicationsService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly t = this.i18n.t;
  readonly date = this.i18n.date;
  readonly statusBadge = STATUS_BADGE;
  readonly statusKeys = STATUS_KEYS;
  readonly statuses = ALL_STATUSES;

  readonly data = signal<Paginated<ApplicationListItem> | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly quickAddOpen = signal(false);

  page = 1;
  status: ApplicationStatus | '' = '';
  search = '';

  readonly rangeLabel = computed(() => {
    const d = this.data();
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
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.applications
      .list({
        page: this.page,
        status: this.status || undefined,
        search: this.search.trim() || undefined,
      })
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

  onQuickAdded(result: QuickApplicationResult): void {
    this.quickAddOpen.set(false);
    if (result.continueEditing) {
      this.router.navigate(['/applications', result.application.id, 'edit']);
      return;
    }
    // A filtered view could hide what was just created, which reads as "nothing
    // happened". Clear the filters so the new application is actually on screen.
    this.page = 1;
    this.status = '';
    this.search = '';
    this.load();
  }

  avatarColor(name: string): string {
    return avatarColor(name);
  }
}
