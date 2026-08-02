import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '../../core/auth.service';
import {
  I18nService,
  LOCALE_NAMES,
  Locale,
  SUPPORTED_LOCALES,
} from '../../core/i18n';
import { ProfileService } from '../../core/profile.service';
import { Flag } from './flag';

/** Where the panel opens, relative to the trigger. */
export type SwitcherPlacement = 'bottom-start' | 'bottom-end' | 'top-start';

/**
 * Language picker. Switching is instant and local; when a session exists the
 * choice is also written to `UserSettings` so it follows the user to their
 * other devices. A failed write is deliberately silent — the UI has already
 * switched, and the local preference survives the reload either way.
 *
 * Built as a button + listbox rather than a native `<select>`: a `<select>`
 * cannot render a flag inside its options, and its control/option box models
 * are styled by the OS, which is what made the previous version sit off-centre.
 */
@Component({
  selector: 'app-language-switcher',
  imports: [Flag],
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcher {
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly profileApi = inject(ProfileService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** `nav` matches the sidebar rows; `button` is a standalone bordered pill. */
  readonly variant = input<'nav' | 'button'>('button');
  readonly placement = input<SwitcherPlacement>('bottom-start');

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly t = this.i18n.t;
  protected readonly locale = this.i18n.locale;
  protected readonly locales = SUPPORTED_LOCALES;
  protected readonly localeNames = LOCALE_NAMES;
  protected readonly open = signal(false);
  protected readonly saving = signal(false);

  protected toggle(): void {
    this.open.update((value) => !value);
    if (this.open()) queueMicrotask(() => this.focusOption(0, true));
  }

  protected select(locale: Locale): void {
    this.close(true);
    if (locale === this.locale()) return;

    this.i18n.setLocale(locale);
    if (!this.auth.isAuthenticated()) return;

    this.saving.set(true);
    this.profileApi.updateSettings({ locale }).subscribe({
      next: () => this.saving.set(false),
      error: () => this.saving.set(false),
    });
  }

  /** Roving focus inside the open panel. */
  protected onPanelKeydown(event: KeyboardEvent): void {
    const options = this.optionElements();
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;

    switch (event.key) {
      case 'ArrowDown':
        this.focusOption(current + 1);
        break;
      case 'ArrowUp':
        this.focusOption(current - 1);
        break;
      case 'Home':
        this.focusOption(0);
        break;
      case 'End':
        this.focusOption(options.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.close(true);
  }

  // Closes on any click outside the component. The trigger lives inside the
  // host, so its own click is not swallowed here and still toggles.
  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  // Tabbing past the last option leaves the panel: close it rather than
  // stranding an open dropdown behind the user's focus.
  @HostListener('focusout', ['$event'])
  protected onFocusOut(event: FocusEvent): void {
    if (!this.open()) return;
    const next = event.relatedTarget as Node | null;
    if (next && !this.host.nativeElement.contains(next)) this.close(false);
  }

  private close(restoreFocus: boolean): void {
    this.open.set(false);
    if (restoreFocus) this.trigger()?.nativeElement.focus();
  }

  private optionElements(): HTMLButtonElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    );
  }

  /** Wraps around; `preferSelected` starts on the active language instead. */
  private focusOption(index: number, preferSelected = false): void {
    const options = this.optionElements();
    if (options.length === 0) return;
    const target = preferSelected
      ? Math.max(0, this.locales.indexOf(this.locale()))
      : (index + options.length) % options.length;
    options[target]?.focus();
  }
}
