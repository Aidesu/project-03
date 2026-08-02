import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompaniesService, CompanyInput } from '../../core/companies.service';
import { COMPANY_SIZE_KEYS, optionsFrom } from '../../core/enums';
import { I18nService, TranslationKey } from '../../core/i18n';
import { CompanyDetail, CompanyListItem } from '../../core/models';
import { Modal } from '../modal/modal';

@Component({
  selector: 'app-company-form',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './company-form.html',
})
export class CompanyForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companiesApi = inject(CompaniesService);
  private readonly i18n = inject(I18nService);

  /** `null` opens in create mode; passing a company opens in edit mode. */
  readonly company = input<CompanyListItem | CompanyDetail | null>(null);
  readonly saved = output<CompanyListItem>();
  readonly cancelled = output<void>();

  readonly t = this.i18n.t;
  // Rebuilt when the locale changes: `t` reads the locale signal.
  readonly sizeOptions = computed(() => optionsFrom(COMPANY_SIZE_KEYS, this.t));
  readonly saving = signal(false);
  readonly formError = signal<TranslationKey | null>(null);

  // Mirrors the server-side DTO limits so the user sees the error before the
  // round-trip; the backend remains the authority.
  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(200),
    ]),
    website: this.fb.nonNullable.control('', [Validators.maxLength(2048)]),
    industry: this.fb.nonNullable.control('', [Validators.maxLength(120)]),
    location: this.fb.nonNullable.control('', [Validators.maxLength(200)]),
    size: this.fb.nonNullable.control('', [Validators.maxLength(50)]),
    notes: this.fb.nonNullable.control('', [Validators.maxLength(5000)]),
  });

  ngOnInit(): void {
    const c = this.company();
    if (!c) return;
    this.form.setValue({
      name: c.name,
      website: c.website ?? '',
      industry: c.industry ?? '',
      location: c.location ?? '',
      size: c.size ?? '',
      notes: c.notes ?? '',
    });
  }

  get isEdit(): boolean {
    return this.company() !== null;
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    // An emptied field is sent as null so the column is cleared, rather than
    // as '' which the server-side @IsUrl() would reject.
    const input: CompanyInput = {
      name: v.name.trim(),
      website: v.website.trim() || null,
      industry: v.industry.trim() || null,
      location: v.location.trim() || null,
      size: v.size.trim() || null,
      notes: v.notes.trim() || null,
    };

    const existing = this.company();
    this.saving.set(true);
    this.formError.set(null);

    const request = existing
      ? this.companiesApi.update(existing.id, input)
      : this.companiesApi.create(input);

    request.subscribe({
      next: (company) => {
        this.saving.set(false);
        this.saved.emit(company);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(
          err instanceof HttpErrorResponse && err.status === 400
            ? 'companyForm.invalidUrl'
            : 'companyForm.saveError',
        );
      },
    });
  }
}
