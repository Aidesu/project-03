import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n';
import { TranslationKey } from '../core/i18n';
import { LanguageSwitcher } from '../shared/language-switcher/language-switcher';

interface NavItem {
  labelKey: TranslationKey;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LanguageSwitcher],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly t = this.i18n.t;
  readonly user = this.auth.user;

  readonly nav: NavItem[] = [
    { labelKey: 'nav.dashboard', path: '/', icon: '◈' },
    { labelKey: 'nav.applications', path: '/applications', icon: '▤' },
    { labelKey: 'nav.network', path: '/network', icon: '◎' },
    { labelKey: 'nav.emailTemplates', path: '/email-templates', icon: '✉' },
    { labelKey: 'nav.progression', path: '/progression', icon: '✦' },
  ];

  readonly avatarUrl = computed(() => this.user()?.avatarUrl ?? null);

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const source = u.name?.trim() || u.email;
    return source.slice(0, 2).toUpperCase();
  });

  readonly displayName = computed(() => {
    const u = this.user();
    return u?.name?.trim() || u?.email || '';
  });

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
