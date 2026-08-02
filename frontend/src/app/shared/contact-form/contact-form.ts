import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CompaniesService } from '../../core/companies.service';
import { ContactInput, ContactsService } from '../../core/contacts.service';
import { I18nService, TranslationKey } from '../../core/i18n';
import { CompanyListItem, Contact, ContactDetail } from '../../core/models';
import { Modal } from '../modal/modal';

/** Server-side cap on `pageSize` — the picker loads a single page of companies. */
const COMPANY_PICKER_LIMIT = 100;

@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './contact-form.html',
})
export class ContactForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly contactsApi = inject(ContactsService);
  private readonly companiesApi = inject(CompaniesService);

  /** `null` opens in create mode; passing a contact opens in edit mode. */
  readonly contact = input<Contact | ContactDetail | null>(null);
  /** Pre-selects a company — used when adding a contact from a company page. */
  readonly defaultCompanyId = input<string | null>(null);
  readonly saved = output<Contact>();
  readonly cancelled = output<void>();

  readonly t = inject(I18nService).t;
  readonly saving = signal(false);
  readonly formError = signal<TranslationKey | null>(null);
  readonly companies = signal<CompanyListItem[]>([]);
  /** True when the user owns more companies than the picker could load. */
  readonly companiesTruncated = signal(false);

  readonly form = this.fb.group({
    firstName: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(120),
    ]),
    lastName: this.fb.nonNullable.control('', [Validators.maxLength(120)]),
    title: this.fb.nonNullable.control('', [Validators.maxLength(120)]),
    companyId: this.fb.nonNullable.control(''),
    email: this.fb.nonNullable.control('', [
      Validators.email,
      Validators.maxLength(254),
    ]),
    phone: this.fb.nonNullable.control('', [Validators.maxLength(40)]),
    linkedinUrl: this.fb.nonNullable.control('', [Validators.maxLength(2048)]),
    notes: this.fb.nonNullable.control('', [Validators.maxLength(5000)]),
  });

  ngOnInit(): void {
    const c = this.contact();
    if (c) {
      this.form.setValue({
        firstName: c.firstName,
        lastName: c.lastName ?? '',
        title: c.title ?? '',
        companyId: c.companyId ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        linkedinUrl: c.linkedinUrl ?? '',
        notes: c.notes ?? '',
      });
    } else if (this.defaultCompanyId()) {
      this.form.controls.companyId.setValue(this.defaultCompanyId() ?? '');
    }

    this.companiesApi
      .list({ pageSize: COMPANY_PICKER_LIMIT, sortBy: 'name', sortOrder: 'asc' })
      .subscribe({
        next: (page) => {
          this.companies.set(page.items);
          this.companiesTruncated.set(page.total > page.items.length);
        },
        // A failed picker load must not block saving the contact itself —
        // the company select just stays empty.
        error: () => this.companies.set([]),
      });
  }

  get isEdit(): boolean {
    return this.contact() !== null;
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const input: ContactInput = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim() || null,
      title: v.title.trim() || null,
      companyId: v.companyId || null,
      email: v.email.trim() || null,
      phone: v.phone.trim() || null,
      linkedinUrl: v.linkedinUrl.trim() || null,
      notes: v.notes.trim() || null,
    };

    const existing = this.contact();
    this.saving.set(true);
    this.formError.set(null);

    const request = existing
      ? this.contactsApi.update(existing.id, input)
      : this.contactsApi.create(input);

    request.subscribe({
      next: (contact) => {
        this.saving.set(false);
        this.saved.emit(contact);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(
          err instanceof HttpErrorResponse && err.status === 400
            ? 'contactForm.invalidFields'
            : 'contactForm.saveError',
        );
      },
    });
  }
}
