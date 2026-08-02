import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService, TranslationKey } from '../core/i18n';
import { LanguageSwitcher } from '../shared/language-switcher/language-switcher';

// Mirrors the backend RegisterDto (password min length 12).
const PASSWORD_MIN = 12;

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, LanguageSwitcher],
  templateUrl: './register.html',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly passwordMin = PASSWORD_MIN;
  readonly loading = signal(false);
  readonly error = signal<TranslationKey | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { name, email, password } = this.form.getRawValue();
    try {
      await this.auth.register({
        email,
        password,
        name: name.trim() || undefined,
      });
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(this.messageFor(err));
    } finally {
      this.loading.set(false);
    }
  }

  private messageFor(err: unknown): TranslationKey {
    if (err instanceof HttpErrorResponse && err.status === 409) {
      return 'register.emailTaken';
    }
    return 'register.error';
  }
}
