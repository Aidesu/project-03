import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { ConfirmService } from '../../core/confirm.service';
import { I18nService } from '../../core/i18n';
import { BackdropDismiss } from '../backdrop-dismiss/backdrop-dismiss';

/**
 * The single confirmation dialog for the whole app, mounted once at the root
 * and driven by {@link ConfirmService}. Pages call `confirm.ask(...)` and get a
 * promise back — they never own dialog state.
 *
 * What the native `confirm()` gave us for free and has to be rebuilt here:
 * Escape and backdrop dismissal, focus moved into the dialog and returned to
 * the trigger afterwards, focus kept inside while it is open, and a role that
 * makes a screen reader announce it.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [BackdropDismiss],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  private readonly confirm = inject(ConfirmService);
  private readonly document = inject(DOCUMENT);
  protected readonly t = inject(I18nService).t;

  protected readonly request = this.confirm.request;

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly cancelButton =
    viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly confirmButton =
    viewChild<ElementRef<HTMLButtonElement>>('confirmButton');

  /** Whatever had focus when the dialog opened, so it can be handed back. */
  private trigger: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.request()) {
        // Runs before the dialog is in the DOM, so this is still the control
        // the user activated.
        this.trigger ??= this.document.activeElement as HTMLElement | null;
      } else if (this.trigger) {
        this.trigger.focus?.();
        this.trigger = null;
      }
    });

    // The destructive action is never the one focused on open: an Enter press
    // in flight when the dialog appears must not be the thing that deletes.
    effect(() => {
      const request = this.request();
      if (!request) return;
      const target =
        request.tone === 'danger' ? this.cancelButton() : this.confirmButton();
      target?.nativeElement.focus();
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.request()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.respond(false);
      return;
    }
    if (event.key === 'Tab') this.trapFocus(event);
  }

  protected respond(confirmed: boolean): void {
    this.confirm.respond(confirmed);
  }

  /**
   * Keeps Tab cycling between the dialog's own controls. Without it, focus
   * walks into the page behind the backdrop, which is both confusing and a way
   * to activate things the overlay is supposed to be blocking.
   */
  private trapFocus(event: KeyboardEvent): void {
    const root = this.panel()?.nativeElement;
    if (!root) return;

    const focusable = [
      ...root.querySelectorAll<HTMLElement>('button:not([disabled])'),
    ];
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.document.activeElement;

    if (!root.contains(active)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
