import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;

  readonly nav: NavItem[] = [
    { label: 'Tableau de bord', path: '/', icon: '◈' },
    { label: 'Candidatures', path: '/applications', icon: '▤' },
    { label: 'Progression', path: '/progression', icon: '✦' },
  ];

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
