import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import {
  ApplicationsService,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '../core/applications.service';
import { ALL_STATUSES, STATUS_META } from '../core/application-status';
import {
  EMPLOYMENT_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  SALARY_PERIOD_OPTIONS,
  SOURCE_OPTIONS,
  WORK_MODE_OPTIONS,
} from '../core/enums';
import {
  ApplicationSource,
  ApplicationStatus,
  EmploymentType,
  Priority,
  SalaryPeriod,
  WorkMode,
} from '../core/models';

@Component({
  selector: 'app-application-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './application-form.html',
})
export class ApplicationForm {
  private readonly fb = inject(FormBuilder);
  private readonly applications = inject(ApplicationsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly statusMeta = STATUS_META;
  readonly statuses = ALL_STATUSES;
  readonly priorityOptions = PRIORITY_OPTIONS;
  readonly workModeOptions = WORK_MODE_OPTIONS;
  readonly employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS;
  readonly sourceOptions = SOURCE_OPTIONS;
  readonly salaryPeriodOptions = SALARY_PERIOD_OPTIONS;
  readonly excitementLevels = [1, 2, 3, 4, 5];

  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.id !== null;
  readonly backLink = this.isEdit
    ? ['/applications', this.id as string]
    : ['/applications'];
  readonly ready = signal(!this.isEdit);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    position: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(200),
    ]),
    companyName: this.fb.nonNullable.control(''),
    location: this.fb.nonNullable.control(''),
    jobUrl: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control<ApplicationStatus>('WISHLIST'),
    priority: this.fb.nonNullable.control<Priority>('MEDIUM'),
    workMode: this.fb.nonNullable.control<WorkMode | ''>(''),
    employmentType: this.fb.nonNullable.control<EmploymentType | ''>(''),
    source: this.fb.nonNullable.control<ApplicationSource | ''>(''),
    salaryMin: this.fb.control<number | null>(null),
    salaryMax: this.fb.control<number | null>(null),
    salaryCurrency: this.fb.nonNullable.control('EUR'),
    salaryPeriod: this.fb.nonNullable.control<SalaryPeriod>('YEAR'),
    excitement: this.fb.control<number | null>(null),
    deadlineAt: this.fb.nonNullable.control(''),
    notes: this.fb.nonNullable.control(''),
  });

  constructor() {
    if (this.isEdit) this.loadForEdit();
  }

  private loadForEdit(): void {
    this.applications.getOne(this.id as string).subscribe({
      next: (d) => {
        this.form.patchValue({
          position: d.position,
          companyName: d.companyName ?? '',
          location: d.location ?? '',
          jobUrl: d.jobUrl ?? '',
          priority: d.priority,
          workMode: d.workMode ?? '',
          employmentType: d.employmentType ?? '',
          source: d.source ?? '',
          salaryMin: d.salaryMin,
          salaryMax: d.salaryMax,
          salaryCurrency: d.salaryCurrency,
          salaryPeriod: d.salaryPeriod,
          excitement: d.excitement,
          deadlineAt: d.deadlineAt ? d.deadlineAt.slice(0, 10) : '',
          notes: d.notes ?? '',
        });
        this.ready.set(true);
      },
      error: () => {
        this.error.set('Candidature introuvable.');
        this.ready.set(true);
      },
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    if (v.salaryMin != null && v.salaryMax != null && v.salaryMin > v.salaryMax) {
      this.error.set('Le salaire minimum ne peut pas dépasser le maximum.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const request: Observable<unknown> = this.isEdit
      ? this.applications.update(this.id as string, this.buildUpdate(v))
      : this.applications.create(this.buildCreate(v));

    request.subscribe({
      next: () => {
        const target = this.isEdit
          ? ['/applications', this.id as string]
          : ['/applications'];
        this.router.navigate(target);
      },
      error: (err: unknown) => {
        this.error.set(this.messageFor(err));
        this.saving.set(false);
      },
    });
  }

  /** Create: send only filled fields. */
  private buildCreate(v: ReturnType<typeof this.form.getRawValue>): CreateApplicationInput {
    const payload: CreateApplicationInput = {
      position: v.position.trim(),
      status: v.status,
      priority: v.priority,
      salaryPeriod: v.salaryPeriod,
    };
    if (v.companyName.trim()) payload.companyName = v.companyName.trim();
    if (v.location.trim()) payload.location = v.location.trim();
    if (v.jobUrl.trim()) payload.jobUrl = v.jobUrl.trim();
    if (v.workMode) payload.workMode = v.workMode;
    if (v.employmentType) payload.employmentType = v.employmentType;
    if (v.source) payload.source = v.source;
    if (v.salaryMin != null) payload.salaryMin = v.salaryMin;
    if (v.salaryMax != null) payload.salaryMax = v.salaryMax;
    if (v.salaryCurrency.trim()) {
      payload.salaryCurrency = v.salaryCurrency.trim().toUpperCase();
    }
    if (v.excitement != null) payload.excitement = v.excitement;
    if (v.deadlineAt) payload.deadlineAt = new Date(v.deadlineAt).toISOString();
    if (v.notes.trim()) payload.notes = v.notes.trim();
    return payload;
  }

  /** Edit: send the full state, using null to clear optional fields. */
  private buildUpdate(v: ReturnType<typeof this.form.getRawValue>): UpdateApplicationInput {
    return {
      position: v.position.trim(),
      companyName: v.companyName.trim() || null,
      location: v.location.trim() || null,
      jobUrl: v.jobUrl.trim() || null,
      priority: v.priority,
      workMode: v.workMode || null,
      employmentType: v.employmentType || null,
      source: v.source || null,
      salaryMin: v.salaryMin ?? null,
      salaryMax: v.salaryMax ?? null,
      salaryCurrency: v.salaryCurrency.trim().toUpperCase() || 'EUR',
      salaryPeriod: v.salaryPeriod,
      excitement: v.excitement ?? null,
      deadlineAt: v.deadlineAt ? new Date(v.deadlineAt).toISOString() : null,
      notes: v.notes.trim() || null,
    };
  }

  private messageFor(err: unknown): string {
    if (err instanceof HttpErrorResponse && err.status === 400) {
      return 'Certains champs sont invalides. Vérifie l’URL et les montants.';
    }
    return 'Impossible d’enregistrer la candidature. Réessaie.';
  }
}
