import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import {
  ApplicationsService,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '../core/applications.service';
import { ApplicationDefaultsService } from '../core/application-defaults.service';
import { ALL_STATUSES, STATUS_KEYS } from '../core/application-status';
import {
  EMPLOYMENT_TYPE_KEYS,
  SALARY_PERIOD_KEYS,
  SOURCE_KEYS,
  WORK_MODE_KEYS,
  labelOf,
  optionsFrom,
} from '../core/enums';
import { I18nService, TranslationKey } from '../core/i18n';
import {
  ApplicationSource,
  ApplicationStatus,
  CompanyListItem,
  EmploymentType,
  SalaryPeriod,
  WorkMode,
} from '../core/models';
import { seedPositionFromLatest } from '../core/position-seed';
import { CompanyLink } from '../shared/company-picker/company-link';
import { CompanyPicker } from '../shared/company-picker/company-picker';

/**
 * The collapsible groups. Everything outside them is the essentials block,
 * which is always visible because it holds the only required field.
 */
type OptionalSection = 'tracking' | 'salary' | 'extras';

const OPTIONAL_SECTIONS = ['tracking', 'salary', 'extras'] as const;

/**
 * Which controls live in which group. Used to reopen the offending group when
 * a submit fails on a field the user cannot currently see.
 */
const SECTION_CONTROLS = {
  tracking: ['source', 'workMode', 'employmentType', 'excitement'],
  salary: ['salaryMin', 'salaryMax', 'salaryCurrency', 'salaryPeriod'],
  extras: ['deadlineAt', 'notes'],
} as const satisfies Record<OptionalSection, readonly string[]>;

/** Mirrors the server's `@IsInt() @Min(0)`. Empty is valid: the field is optional. */
function wholeAmount(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === null || value === '') return null;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? null
    : { wholeAmount: true };
}

/** Mirrors `@Length(3, 3)`. Empty is valid: the server then applies its default. */
function currencyCode(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (value === '') return null;
  return /^[A-Za-z]{3}$/.test(value) ? null : { currencyCode: true };
}

@Component({
  selector: 'app-application-form',
  imports: [CompanyPicker, ReactiveFormsModule, RouterLink],
  templateUrl: './application-form.html',
})
export class ApplicationForm {
  private readonly fb = inject(FormBuilder);
  private readonly applications = inject(ApplicationsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);
  private readonly defaults = inject(ApplicationDefaultsService);

  readonly t = this.i18n.t;
  readonly statusKeys = STATUS_KEYS;
  readonly statuses = ALL_STATUSES;
  readonly workModeOptions = computed(() => optionsFrom(WORK_MODE_KEYS, this.t));
  readonly employmentTypeOptions = computed(() =>
    optionsFrom(EMPLOYMENT_TYPE_KEYS, this.t),
  );
  readonly sourceOptions = computed(() => optionsFrom(SOURCE_KEYS, this.t));
  readonly salaryPeriodOptions = computed(() => optionsFrom(SALARY_PERIOD_KEYS, this.t));
  readonly excitementLevels = [1, 2, 3, 4, 5];

  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.id !== null;
  readonly backLink = this.isEdit
    ? ['/applications', this.id as string]
    : ['/applications'];
  readonly ready = signal(!this.isEdit);
  readonly saving = signal(false);
  readonly error = signal<TranslationKey | null>(null);

  /**
   * How this user classified the last job they logged. Seeded unconditionally:
   * `loadForEdit` patches every one of these fields, so the edit form is
   * unaffected.
   */
  private readonly seed = this.defaults.read();

  readonly form = this.fb.group({
    position: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(200),
    ]),
    companyName: this.fb.nonNullable.control('', [Validators.maxLength(200)]),
    // Set only by picking an existing company; never typed by hand.
    companyId: this.fb.nonNullable.control(''),
    location: this.fb.nonNullable.control('', [Validators.maxLength(200)]),
    jobUrl: this.fb.nonNullable.control('', [Validators.maxLength(2048)]),
    status: this.fb.nonNullable.control<ApplicationStatus>('WISHLIST'),
    workMode: this.fb.nonNullable.control<WorkMode | ''>(this.seed.workMode),
    employmentType: this.fb.nonNullable.control<EmploymentType | ''>(
      this.seed.employmentType,
    ),
    source: this.fb.nonNullable.control<ApplicationSource | ''>(this.seed.source),
    salaryMin: this.fb.control<number | null>(null, [wholeAmount]),
    salaryMax: this.fb.control<number | null>(null, [wholeAmount]),
    salaryCurrency: this.fb.nonNullable.control(this.seed.salaryCurrency, [
      currencyCode,
    ]),
    salaryPeriod: this.fb.nonNullable.control<SalaryPeriod>(this.seed.salaryPeriod),
    excitement: this.fb.control<number | null>(null),
    deadlineAt: this.fb.nonNullable.control(''),
    notes: this.fb.nonNullable.control('', [Validators.maxLength(5000)]),
  });

  /**
   * Mirror of the form state, so the collapsed-section summaries recompute on
   * every keystroke without the template reaching into the control tree.
   */
  private readonly value = signal(this.form.getRawValue());

  private readonly companyLink = new CompanyLink(
    this.form.controls.companyName,
    this.form.controls.companyId,
  );

  private readonly openSections = signal<Record<OptionalSection, boolean>>({
    tracking: false,
    salary: false,
    extras: false,
  });

  readonly trackingSummary = computed(() => {
    const v = this.value();
    return [
      labelOf(SOURCE_KEYS, v.source || null, this.t),
      labelOf(WORK_MODE_KEYS, v.workMode || null, this.t),
      labelOf(EMPLOYMENT_TYPE_KEYS, v.employmentType || null, this.t),
      v.excitement ? '★'.repeat(v.excitement) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  readonly salarySummary = computed(() => {
    const v = this.value();
    if (v.salaryMin === null && v.salaryMax === null) return '';
    const amount = (n: number) => this.i18n.number(n);
    const range =
      v.salaryMin !== null && v.salaryMax !== null
        ? `${amount(v.salaryMin)} – ${amount(v.salaryMax)}`
        : amount((v.salaryMin ?? v.salaryMax) as number);
    const currency = v.salaryCurrency.trim().toUpperCase() || 'EUR';
    return `${range} ${currency} ${labelOf(SALARY_PERIOD_KEYS, v.salaryPeriod, this.t)}`;
  });

  readonly extrasSummary = computed(() => {
    const v = this.value();
    return [
      // Date-only value: rendered as a calendar day so the user's zone cannot
      // shift it onto the neighbouring day.
      v.deadlineAt ? this.i18n.calendarDay(v.deadlineAt, { dateStyle: 'short' }) : '',
      v.notes.trim() ? this.t('applicationForm.notes') : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  private readonly summaries = {
    tracking: this.trackingSummary,
    salary: this.salarySummary,
    extras: this.extrasSummary,
  } satisfies Record<OptionalSection, () => string>;

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.companyLink.reconcile();
      this.value.set(this.form.getRawValue());
    });
    if (this.isEdit) this.loadForEdit();
    else seedPositionFromLatest(this.form.controls.position);
  }

  /** Picking a company links the real row and fills in what it already knows. */
  onCompanyPicked(company: CompanyListItem): void {
    this.companyLink.select(company);
    // Never overwrite something the user typed themselves.
    if (company.location && !this.form.controls.location.value.trim()) {
      this.form.controls.location.setValue(company.location);
    }
  }

  isOpen(section: OptionalSection): boolean {
    return this.openSections()[section];
  }

  toggle(section: OptionalSection): void {
    this.openSections.update((state) => ({ ...state, [section]: !state[section] }));
  }

  private open(section: OptionalSection): void {
    this.openSections.update((state) =>
      state[section] ? state : { ...state, [section]: true },
    );
  }

  private loadForEdit(): void {
    this.applications.getOne(this.id as string).subscribe({
      next: (d) => {
        // Restore the address-book link, but only when the stored name still
        // matches it — `reconcile` would otherwise drop it right away.
        const linked =
          d.company && d.company.name === (d.companyName ?? '').trim()
            ? d.company
            : null;
        this.companyLink.restore(linked);
        this.form.patchValue({
          position: d.position,
          companyName: d.companyName ?? '',
          companyId: linked?.id ?? '',
          location: d.location ?? '',
          jobUrl: d.jobUrl ?? '',
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
        // Never hide data the user already entered: a group with content starts
        // open, an empty one stays collapsed.
        for (const section of OPTIONAL_SECTIONS) {
          if (this.summaries[section]()) this.open(section);
        }
        this.ready.set(true);
      },
      error: () => {
        this.error.set('applicationForm.notFound');
        this.ready.set(true);
      },
    });
  }

  submit(): void {
    if (this.saving()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.revealInvalidSections();
      return;
    }

    const v = this.form.getRawValue();
    if (v.salaryMin !== null && v.salaryMax !== null && v.salaryMin > v.salaryMax) {
      this.error.set('applicationForm.salaryRangeError');
      this.open('salary');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const request: Observable<unknown> = this.isEdit
      ? this.applications.update(this.id as string, this.buildUpdate(v))
      : this.applications.create(this.buildCreate(v));

    request.subscribe({
      next: () => {
        // Only on create: editing an old application must not rewrite how the
        // next new one is pre-filled.
        if (!this.isEdit) {
          this.defaults.remember({
            source: v.source,
            workMode: v.workMode,
            employmentType: v.employmentType,
            salaryPeriod: v.salaryPeriod,
            salaryCurrency: v.salaryCurrency,
          });
        }
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

  /** An error the user cannot see is an error they cannot fix. */
  private revealInvalidSections(): void {
    for (const section of OPTIONAL_SECTIONS) {
      const invalid = SECTION_CONTROLS[section].some(
        (name) => this.form.get(name)?.invalid,
      );
      if (invalid) this.open(section);
    }
  }

  /** Create: send only filled fields. */
  private buildCreate(v: ReturnType<typeof this.form.getRawValue>): CreateApplicationInput {
    const payload: CreateApplicationInput = {
      position: v.position.trim(),
      status: v.status,
      salaryPeriod: v.salaryPeriod,
    };
    if (v.companyName.trim()) payload.companyName = v.companyName.trim();
    if (v.companyId) payload.companyId = v.companyId;
    if (v.location.trim()) payload.location = v.location.trim();
    if (v.jobUrl.trim()) payload.jobUrl = v.jobUrl.trim();
    if (v.workMode) payload.workMode = v.workMode;
    if (v.employmentType) payload.employmentType = v.employmentType;
    if (v.source) payload.source = v.source;
    if (v.salaryMin !== null) payload.salaryMin = v.salaryMin;
    if (v.salaryMax !== null) payload.salaryMax = v.salaryMax;
    if (v.salaryCurrency.trim()) {
      payload.salaryCurrency = v.salaryCurrency.trim().toUpperCase();
    }
    if (v.excitement !== null) payload.excitement = v.excitement;
    if (v.deadlineAt) payload.deadlineAt = new Date(v.deadlineAt).toISOString();
    if (v.notes.trim()) payload.notes = v.notes.trim();
    return payload;
  }

  /** Edit: send the full state, using null to clear optional fields. */
  private buildUpdate(v: ReturnType<typeof this.form.getRawValue>): UpdateApplicationInput {
    const payload: UpdateApplicationInput = {
      position: v.position.trim(),
      companyName: v.companyName.trim() || null,
      location: v.location.trim() || null,
      jobUrl: v.jobUrl.trim() || null,
      workMode: v.workMode || null,
      employmentType: v.employmentType || null,
      source: v.source || null,
      salaryMin: v.salaryMin ?? null,
      salaryMax: v.salaryMax ?? null,
      salaryCurrency: v.salaryCurrency.trim().toUpperCase() || this.seed.salaryCurrency,
      salaryPeriod: v.salaryPeriod,
      excitement: v.excitement ?? null,
      deadlineAt: v.deadlineAt ? new Date(v.deadlineAt).toISOString() : null,
      notes: v.notes.trim() || null,
    };
    // Omitted rather than nulled: the server then re-resolves the link from the
    // name, which is what should happen once the user edits it back to free text.
    if (v.companyId) payload.companyId = v.companyId;
    return payload;
  }

  private messageFor(err: unknown): TranslationKey {
    if (err instanceof HttpErrorResponse && err.status === 400) {
      return 'applicationForm.invalidFields';
    }
    return 'applicationForm.saveError';
  }
}
