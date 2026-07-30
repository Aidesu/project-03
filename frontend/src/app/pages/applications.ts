import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApplicationsService } from '../core/applications.service';
import { ALL_STATUSES, STATUS_META } from '../core/application-status';
import { avatarColor } from '../core/avatar-color';
import {
  ApplicationListItem,
  ApplicationStatus,
  Paginated,
} from '../core/models';

@Component({
  selector: 'app-applications',
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './applications.html',
})
export class Applications {
  private readonly applications = inject(ApplicationsService);

  readonly statusMeta = STATUS_META;
  readonly statuses = ALL_STATUSES;

  readonly data = signal<Paginated<ApplicationListItem> | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  page = 1;
  status: ApplicationStatus | '' = '';
  search = '';

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

  avatarColor(name: string): string {
    return avatarColor(name);
  }
}
