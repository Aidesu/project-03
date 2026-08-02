import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService, TranslationKey } from '../core/i18n';
import { LanguageSwitcher } from '../shared/language-switcher/language-switcher';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, LanguageSwitcher],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly loading = signal(false);
  // Errors are held as translation keys, not rendered strings, so a language
  // switch while the message is on screen re-renders it in the new language.
  readonly error = signal<TranslationKey | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email, password);
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(this.messageFor(err));
    } finally {
      this.loading.set(false);
    }
  }

  private messageFor(err: unknown): TranslationKey {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      return 'login.invalidCredentials';
    }
    return 'login.error';
  }
}
