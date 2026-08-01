import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationsService } from '../core/applications.service';
import { ALL_STATUSES, STATUS_META } from '../core/application-status';
import { AuthService } from '../core/auth.service';
import { EmailTemplatesService } from '../core/email-templates.service';
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
import { ApplicationDetail, ApplicationStatus, EmailTemplate } from '../core/models';
import { renderTemplate, TemplateVars } from '../core/template-vars';

@Component({
  selector: 'app-application-detail',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './application-detail.html',
})
export class ApplicationDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly applications = inject(ApplicationsService);
  private readonly emailTemplatesApi = inject(EmailTemplatesService);
  private readonly auth = inject(AuthService);

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

  readonly templates = signal<EmailTemplate[]>([]);
  readonly copied = signal(false);
  readonly copyError = signal<string | null>(null);

  selectedStatus: ApplicationStatus = 'WISHLIST';
  note = '';
  selectedTemplateId = '';

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  constructor() {
    this.reload();
    this.emailTemplatesApi.list().subscribe({
      next: (items) => this.templates.set(items),
      // Non-fatal: the "copy an email" widget just stays empty.
      error: () => {},
    });
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

  preview(d: ApplicationDetail): { subject: string; body: string } | null {
    const t = this.templates().find((x) => x.id === this.selectedTemplateId);
    if (!t) return null;
    const vars = this.varsFor(d);
    return { subject: renderTemplate(t.subject, vars), body: renderTemplate(t.body, vars) };
  }

  async copyEmail(d: ApplicationDetail): Promise<void> {
    const p = this.preview(d);
    if (!p) return;
    this.copyError.set(null);
    const text = `Objet : ${p.subject}\n\n${p.body}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copyError.set(
        'Impossible de copier automatiquement — sélectionne le texte manuellement.',
      );
    }
  }

  private varsFor(d: ApplicationDetail): TemplateVars {
    const user = this.auth.user();
    return {
      poste: d.position,
      entreprise: d.company?.name || d.companyName,
      contact_prenom: d.primaryContact?.firstName,
      contact_nom: d.primaryContact?.lastName,
      mon_nom: user?.name || user?.email,
    };
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
