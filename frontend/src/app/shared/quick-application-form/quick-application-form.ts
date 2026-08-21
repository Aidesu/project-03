import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ApplicationsService,
  CreateApplicationInput,
} from '../../core/applications.service';
import { ALL_STATUSES, STATUS_KEYS } from '../../core/application-status';
import { I18nService, TranslationKey } from '../../core/i18n';
import {
  ApplicationListItem,
  ApplicationStatus,
  CompanyListItem,
} from '../../core/models';
import { seedPositionFromLatest } from '../../core/position-seed';
import { CompanyLink } from '../company-picker/company-link';
import { CompanyPicker } from '../company-picker/company-picker';
import { Modal } from '../modal/modal';

export interface QuickApplicationResult {
  application: ApplicationListItem;
  /** The user chose to keep going in the full form rather than stop here. */
  continueEditing: boolean;
}

/**
 * Three-field path to a saved application: job title, company, status.
 *
 * Everything else keeps its server-side default, so the barrier to logging an
 * application is one required field. Same `POST /api/applications` as the full
 * form — there is no lighter write path.
 */
@Component({
  selector: 'app-quick-application-form',
  imports: [CompanyPicker, Modal, ReactiveFormsModule],
  templateUrl: './quick-application-form.html',
})
export class QuickApplicationForm {
  private readonly fb = inject(FormBuilder);
  private readonly applications = inject(ApplicationsService);

  readonly t = inject(I18nService).t;
  readonly statusKeys = STATUS_KEYS;
  readonly statuses = ALL_STATUSES;

  readonly saved = output<QuickApplicationResult>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly error = signal<TranslationKey | null>(null);

  readonly form = this.fb.group({
    position: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(200),
    ]),
    companyName: this.fb.nonNullable.control('', [Validators.maxLength(200)]),
    companyId: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control<ApplicationStatus>('WISHLIST'),
  });

  private readonly companyLink = new CompanyLink(
    this.form.controls.companyName,
    this.form.controls.companyId,
  );

  constructor() {
    this.form.controls.companyName.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.companyLink.reconcile());
    seedPositionFromLatest(this.form.controls.position);
  }

  onCompanyPicked(company: CompanyListItem): void {
    this.companyLink.select(company);
  }

  submit(continueEditing = false): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: CreateApplicationInput = {
      position: v.position.trim(),
      status: v.status,
    };
    if (v.companyName.trim()) payload.companyName = v.companyName.trim();
    if (v.companyId) payload.companyId = v.companyId;

    this.saving.set(true);
    this.error.set(null);

    this.applications.create(payload).subscribe({
      next: (application) => {
        this.saving.set(false);
        this.saved.emit({ application, continueEditing });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(
          err instanceof HttpErrorResponse && err.status === 400
            ? 'applicationForm.invalidFields'
            : 'applicationForm.saveError',
        );
      },
    });
  }
}
