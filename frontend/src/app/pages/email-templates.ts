import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmailTemplateInput, EmailTemplatesService } from '../core/email-templates.service';
import { ConfirmService } from '../core/confirm.service';
import { EMAIL_TEMPLATE_CATEGORY_KEYS, optionsFrom } from '../core/enums';
import { I18nService, TranslationKey } from '../core/i18n';
import { EmailTemplate, EmailTemplateCategory } from '../core/models';
import { TEMPLATE_VARIABLE_HINTS } from '../core/template-vars';

@Component({
  selector: 'app-email-templates',
  imports: [ReactiveFormsModule],
  templateUrl: './email-templates.html',
})
export class EmailTemplates {
  private readonly fb = inject(FormBuilder);
  private readonly templatesApi = inject(EmailTemplatesService);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly categoryOptions = computed(() =>
    optionsFrom(EMAIL_TEMPLATE_CATEGORY_KEYS, this.t),
  );
  readonly variableHints = TEMPLATE_VARIABLE_HINTS;

  // The `{{token}}` names are user-content syntax, so they are injected as ICU
  // arguments rather than written into the catalogue — a translator can move
  // them around the sentence but cannot rename or break them.
  private readonly tokenArgs = {
    poste: '{{poste}}',
    entreprise: '{{entreprise}}',
    contact_prenom: '{{contact_prenom}}',
  };

  readonly subjectPlaceholder = computed(() =>
    this.t('emailTemplates.form.subjectPlaceholder', this.tokenArgs),
  );
  readonly bodyPlaceholder = computed(
    () => `${this.t('emailTemplates.form.bodyPlaceholder', this.tokenArgs)}\n\n`,
  );

  readonly templates = signal<EmailTemplate[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<TranslationKey | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly copiedId = signal<string | null>(null);
  readonly copyError = signal<TranslationKey | null>(null);
  readonly showForm = signal(false);

  editingId: string | null = null;

  readonly grouped = computed(() => {
    const items = this.templates();
    return this.categoryOptions()
      .map((opt) => ({
        category: opt.value,
        label: opt.label,
        items: items.filter((t) => t.category === opt.value),
      }))
      .filter((g) => g.items.length > 0);
  });

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    category: this.fb.nonNullable.control<EmailTemplateCategory>('OTHER'),
    subject: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    body: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(5000)]),
  });

  private copyResetHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.templatesApi.list().subscribe({
      next: (items) => {
        this.templates.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form.reset({ name: '', category: 'OTHER', subject: '', body: '' });
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEdit(t: EmailTemplate): void {
    this.editingId = t.id;
    this.form.reset({
      name: t.name,
      category: t.category,
      subject: t.subject,
      body: t.body,
    });
    this.formError.set(null);
    this.showForm.set(true);
  }

  cancel(): void {
    this.showForm.set(false);
    this.editingId = null;
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const input: EmailTemplateInput = {
      name: v.name.trim(),
      category: v.category,
      subject: v.subject.trim(),
      body: v.body,
    };

    this.saving.set(true);
    this.formError.set(null);
    const request = this.editingId
      ? this.templatesApi.update(this.editingId, input)
      : this.templatesApi.create(input);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingId = null;
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('emailTemplates.saveError');
      },
    });
  }

  async remove(t: EmailTemplate): Promise<void> {
    if (this.deletingId()) return;
    const confirmed = await this.confirm.ask({
      title: 'emailTemplates.confirmDelete.title',
      message: 'emailTemplates.confirmDelete.body',
      params: { name: t.name },
      confirmLabel: 'common.delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.deletingId.set(t.id);
    this.templatesApi.remove(t.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.load();
      },
      error: () => this.deletingId.set(null),
    });
  }

  /** Copies "subject + body" as one block — plain text, so nothing to sanitize. */
  async copy(t: EmailTemplate): Promise<void> {
    this.copyError.set(null);
    const subjectLine = this.t('common.emailSubjectPrefix', { subject: t.subject });
    const text = `${subjectLine}\n\n${t.body}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedId.set(t.id);
      if (this.copyResetHandle) clearTimeout(this.copyResetHandle);
      this.copyResetHandle = setTimeout(() => this.copiedId.set(null), 2000);
    } catch {
      this.copyError.set('emailTemplates.copyError');
    }
  }
}
