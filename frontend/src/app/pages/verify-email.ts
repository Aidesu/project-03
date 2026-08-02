import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n';
import { LanguageSwitcher } from '../shared/language-switcher/language-switcher';

type State = 'checking' | 'done' | 'invalid';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink, LanguageSwitcher],
  templateUrl: './verify-email.html',
})
export class VerifyEmail {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly state = signal<State>('checking');
  readonly isAuthenticated = this.auth.isAuthenticated;

  constructor() {
    void this.verify();
  }

  private async verify(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('invalid');
      return;
    }
    try {
      await this.auth.verifyEmail(token);
      this.state.set('done');
    } catch {
      // Expired, already used or unknown — the server does not distinguish,
      // and neither does the screen.
      this.state.set('invalid');
    }
  }
}
