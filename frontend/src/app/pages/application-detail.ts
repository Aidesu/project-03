import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApplicationsService } from '../core/applications.service';
import { ClipboardService } from '../core/clipboard.service';
import { ConfirmService } from '../core/confirm.service';
import { ALL_STATUSES, STATUS_BADGE, STATUS_KEYS } from '../core/application-status';
import { AuthService } from '../core/auth.service';
import { EmailTemplatesService } from '../core/email-templates.service';
import { externalUrl } from '../core/external-url';
import {
  EMPLOYMENT_TYPE_KEYS,
  SALARY_PERIOD_KEYS,
  SOURCE_KEYS,
  WORK_MODE_KEYS,
  labelOf,
} from '../core/enums';
import { I18nService, TranslationKey } from '../core/i18n';
import { ApplicationDetail, ApplicationStatus, EmailTemplate } from '../core/models';
import { renderTemplate, slotFor, TemplatePart, TemplateVars } from '../core/template-vars';

@Component({
  selector: 'app-application-detail',
  imports: [FormsModule, RouterLink],
  templateUrl: './application-detail.html',
})
export class ApplicationDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly applications = inject(ApplicationsService);
  private readonly clipboard = inject(ClipboardService);
  private readonly confirm = inject(ConfirmService);
  private readonly emailTemplatesApi = inject(EmailTemplatesService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly date = this.i18n.date;
  readonly dateTime = this.i18n.dateTime;

  readonly statusBadge = STATUS_BADGE;
  readonly statusKeys = STATUS_KEYS;
  readonly statuses = ALL_STATUSES;

  readonly detail = signal<ApplicationDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly updating = signal(false);
  readonly deleting = signal(false);

  readonly templates = signal<EmailTemplate[]>([]);
  readonly copyError = signal<TranslationKey | null>(null);

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

  // ---- Localized display helpers --------------------------------------

  websiteHref(website: string | null): string | null {
    return externalUrl(website);
  }

  workModeLabel(value: ApplicationDetail['workMode']): string {
    return labelOf(WORK_MODE_KEYS, value, this.t);
  }

  employmentTypeLabel(value: ApplicationDetail['employmentType']): string {
    return labelOf(EMPLOYMENT_TYPE_KEYS, value, this.t);
  }

  sourceLabel(value: ApplicationDetail['source']): string {
    return labelOf(SOURCE_KEYS, value, this.t);
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

  async remove(): Promise<void> {
    if (this.deleting()) return;
    const confirmed = await this.confirm.ask({
      title: 'applicationDetail.danger.confirm.title',
      message: 'applicationDetail.danger.confirm.body',
      confirmLabel: 'common.delete',
      tone: 'danger',
    });
    if (!confirmed) return;
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

  /**
   * Subject and body go to the clipboard separately: they are pasted into two
   * different fields of the mail client, and the variables are already
   * substituted at this point.
   */
  copySubject(d: ApplicationDetail): Promise<void> {
    return this.copyPart(d, 'subject');
  }

  copyBody(d: ApplicationDetail): Promise<void> {
    return this.copyPart(d, 'body');
  }

  isCopied(part: TemplatePart): boolean {
    return this.clipboard.isCopied(slotFor(this.selectedTemplateId, part));
  }

  private async copyPart(d: ApplicationDetail, part: TemplatePart): Promise<void> {
    const rendered = this.preview(d);
    if (!rendered) return;
    this.copyError.set(null);
    const ok = await this.clipboard.copy(rendered[part], slotFor(this.selectedTemplateId, part));
    if (!ok) this.copyError.set('applicationDetail.email.copyFailed');
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
    const fmt = (n: number) => this.i18n.number(n);
    const range =
      d.salaryMin != null && d.salaryMax != null
        ? `${fmt(d.salaryMin)} – ${fmt(d.salaryMax)}`
        : fmt((d.salaryMin ?? d.salaryMax) as number);
    const period = labelOf(SALARY_PERIOD_KEYS, d.salaryPeriod, this.t);
    return `${range} ${d.salaryCurrency} ${period}`;
  }
}
