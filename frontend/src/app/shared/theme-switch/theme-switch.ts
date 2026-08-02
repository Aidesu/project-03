import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n';
import { ThemeService } from '../../core/theme.service';

/**
 * Two positions, not three: `system` is where the preference starts, and the
 * switch shows what is on screen. Handing the choice back to the OS is a
 * deliberate act and lives in the profile page, not here.
 */
@Component({
  selector: 'app-theme-switch',
  templateUrl: './theme-switch.html',
})
export class ThemeSwitch {
  private readonly theme = inject(ThemeService);

  /** `nav` matches the sidebar row grid; the default is the compact top bar. */
  readonly variant = input<'nav' | 'compact'>('compact');

  readonly t = inject(I18nService).t;
  readonly isDark = this.theme.isDark;

  readonly label = computed(() =>
    this.t(this.isDark() ? 'theme.dark' : 'theme.light'),
  );

  toggle(): void {
    this.theme.toggle();
  }
}
