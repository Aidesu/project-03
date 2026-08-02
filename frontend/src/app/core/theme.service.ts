import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

/** Must match the key the inline bootstrap script in index.html reads. */
const STORAGE_KEY = 'jobquest.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * `system` is the starting state, not a third position on the switch: until the
 * user disagrees with their OS, following it is the right answer. Flipping the
 * switch commits to `light` or `dark` and stops tracking.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly _preference = signal<ThemePreference>(this.readStored());
  readonly preference = this._preference.asReadonly();

  private readonly systemDark = signal(this.systemPrefersDark());

  /** What is actually on screen right now. */
  readonly isDark = computed(() =>
    this._preference() === 'system' ? this.systemDark() : this._preference() === 'dark',
  );

  constructor() {
    this.watchSystem();

    effect(() => {
      const dark = this.isDark();
      const root = this.document.documentElement;
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
      // Belt and braces with the CSS `color-scheme`: this one is read even
      // before the stylesheet resolves, e.g. for the initial canvas paint.
      root.style.colorScheme = dark ? 'dark' : 'light';
    });
  }

  set(preference: ThemePreference): void {
    this._preference.set(preference);
    this.persist(preference);
  }

  /** The switch: commits to the opposite of what is currently shown. */
  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  /** Hands the choice back to the operating system. */
  followSystem(): void {
    this.set('system');
  }

  private watchSystem(): void {
    const media = this.document.defaultView?.matchMedia?.(DARK_QUERY);
    // Keeps `system` live: the OS can flip at sunset while the app is open.
    media?.addEventListener('change', (event) => this.systemDark.set(event.matches));
  }

  private systemPrefersDark(): boolean {
    return this.document.defaultView?.matchMedia?.(DARK_QUERY).matches ?? false;
  }

  private readStored(): ThemePreference {
    try {
      const value = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      return isPreference(value) ? value : 'system';
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). Following
      // the OS is a fine answer when we cannot remember a choice.
      return 'system';
    }
  }

  private persist(preference: ThemePreference): void {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* see readStored() */
    }
  }
}
