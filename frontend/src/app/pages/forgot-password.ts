import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AuthService,
  PASSWORD_RESET_TTL_MINUTES,
} from '../core/auth.service';
import { I18nService, TranslationKey } from '../core/i18n';
import { LanguageSwitcher } from '../shared/language-switcher/language-switcher';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, LanguageSwitcher],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly ttlMinutes = PASSWORD_RESET_TTL_MINUTES;
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal<TranslationKey | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.requestPasswordReset(this.form.getRawValue().email);
      // Deliberately the same confirmation whether or not the address is
      // known: the screen must not become an account oracle either.
      this.sent.set(true);
    } catch (err) {
      this.error.set(
        err instanceof HttpErrorResponse && err.status === 429
          ? 'forgotPassword.tooMany'
          : 'forgotPassword.error',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
