import { Component, HostListener, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n';
import { BackdropDismiss } from '../backdrop-dismiss/backdrop-dismiss';

/**
 * Centered dialog with a dimmed backdrop. Purely presentational: the parent
 * owns the open/closed state and decides what `closed` does.
 */
@Component({
  selector: 'app-modal',
  imports: [BackdropDismiss],
  templateUrl: './modal.html',
})
export class Modal {
  protected readonly t = inject(I18nService).t;

  readonly title = input.required<string>();
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
