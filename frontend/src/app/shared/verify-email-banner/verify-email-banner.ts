import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { I18nService, TranslationKey } from '../../core/i18n';

type State = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Nudges an unverified account to confirm its address.
 *
 * Verification is not a gate: the app works unverified. What it buys is a
 * trustworthy recovery channel — an unconfirmed address means a forgotten
 * password has nowhere to go.
 */
@Component({
  selector: 'app-verify-email-banner',
  templateUrl: './verify-email-banner.html',
})
export class VerifyEmailBanner {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly state = signal<State>('idle');
  private readonly dismissed = signal(false);

  readonly visible = computed(
    () => this.auth.user()?.emailVerified === false && !this.dismissed(),
  );

  readonly message = computed<TranslationKey>(() => {
    switch (this.state()) {
      case 'sent':
        return 'emailBanner.sent';
      case 'error':
        return 'emailBanner.error';
      default:
        return 'emailBanner.text';
    }
  });

  dismiss(): void {
    // Session-scoped only: the next load asks again, because an unrecoverable
    // account is not something to let someone forget permanently.
    this.dismissed.set(true);
  }

  async resend(): Promise<void> {
    if (this.state() === 'sending') return;
    this.state.set('sending');
    try {
      await this.auth.resendEmailVerification();
      this.state.set('sent');
    } catch {
      this.state.set('error');
    }
  }
}
