import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService, TranslationKey } from '../core/i18n';
import { LanguageSwitcher } from '../shared/language-switcher/language-switcher';

// Mirrors the backend ResetPasswordDto.
const PASSWORD_MIN = 12;

/** Confirmation field: a typo here locks the account out for another round trip. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirm')?.value as string;
  return !confirm || password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, LanguageSwitcher],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly passwordMin = PASSWORD_MIN;
  readonly loading = signal(false);
  readonly done = signal(false);
  readonly error = signal<TranslationKey | null>(null);

  // Read once, never rendered: the token is a credential, so it stays out of
  // the DOM and out of anything that could end up in a screenshot or a log.
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly hasToken = this.token.length > 0;

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading() || !this.hasToken) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.resetPassword(this.token, this.form.getRawValue().password);
      this.done.set(true);
    } catch (err) {
      this.error.set(this.messageFor(err));
    } finally {
      this.loading.set(false);
    }
  }

  private messageFor(err: unknown): TranslationKey {
    if (err instanceof HttpErrorResponse) {
      // The server answers the same 400 for expired, already-used and unknown
      // — there is nothing more specific to tell the user.
      if (err.status === 400) return 'resetPassword.invalidLink';
      if (err.status === 429) return 'forgotPassword.tooMany';
    }
    return 'resetPassword.error';
  }
}
