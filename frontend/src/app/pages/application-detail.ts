import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationsService } from '../core/applications.service';
import { ALL_STATUSES, STATUS_META } from '../core/application-status';
import {
  EMPLOYMENT_TYPE_OPTIONS,
  INTERVIEW_OUTCOME_LABEL,
  INTERVIEW_TYPE_LABEL,
  PRIORITY_OPTIONS,
  SALARY_PERIOD_OPTIONS,
  SOURCE_OPTIONS,
  WORK_MODE_OPTIONS,
  labelOf,
} from '../core/enums';
import { ApplicationDetail, ApplicationStatus } from '../core/models';

@Component({
  selector: 'app-application-detail',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './application-detail.html',
})
export class ApplicationDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly applications = inject(ApplicationsService);

  readonly statusMeta = STATUS_META;
  readonly statuses = ALL_STATUSES;
  readonly priorityOptions = PRIORITY_OPTIONS;
  readonly workModeOptions = WORK_MODE_OPTIONS;
  readonly employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS;
  readonly sourceOptions = SOURCE_OPTIONS;
  readonly salaryPeriodOptions = SALARY_PERIOD_OPTIONS;
  readonly interviewTypeLabel = INTERVIEW_TYPE_LABEL;
  readonly interviewOutcomeLabel = INTERVIEW_OUTCOME_LABEL;
  readonly labelOf = labelOf;

  readonly detail = signal<ApplicationDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly updating = signal(false);
  readonly deleting = signal(false);

  selectedStatus: ApplicationStatus = 'WISHLIST';
  note = '';

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(false);
    this.applications.getOne(this.id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.selectedStatus = d.status;
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  updateStatus(): void {
    const d = this.detail();
    if (!d || this.updating() || this.selectedStatus === d.status) return;
    this.updating.set(true);
    this.applications
      .changeStatus(this.id, this.selectedStatus, this.note.trim() || undefined)
      .subscribe({
        next: (updated) => {
          this.detail.set(updated);
          this.selectedStatus = updated.status;
          this.note = '';
          this.updating.set(false);
        },
        error: () => this.updating.set(false),
      });
  }

  remove(): void {
    if (this.deleting()) return;
    if (!confirm('Supprimer définitivement cette candidature ?')) return;
    this.deleting.set(true);
    this.applications.remove(this.id).subscribe({
      next: () => this.router.navigate(['/applications']),
      error: () => this.deleting.set(false),
    });
  }

  salaryText(d: ApplicationDetail): string | null {
    if (d.salaryMin == null && d.salaryMax == null) return null;
    const fmt = (n: number) => n.toLocaleString('fr-FR');
    const range =
      d.salaryMin != null && d.salaryMax != null
        ? `${fmt(d.salaryMin)} – ${fmt(d.salaryMax)}`
        : fmt((d.salaryMin ?? d.salaryMax) as number);
    const period = labelOf(this.salaryPeriodOptions, d.salaryPeriod);
    return `${range} ${d.salaryCurrency} ${period}`;
  }
}
