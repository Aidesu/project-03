import { Injectable, signal } from '@angular/core';
import type { MessageParams, TranslationKey } from './i18n';

export type ConfirmTone = 'neutral' | 'danger';

export interface ConfirmOptions {
  /** Short question, rendered as the dialog heading. */
  title: TranslationKey;
  /** What actually happens if the user goes ahead. */
  message: TranslationKey;
  /** Interpolated into both the title and the message. */
  params?: MessageParams;
  confirmLabel?: TranslationKey;
  cancelLabel?: TranslationKey;
  /** `danger` gives the confirm button the filled-red, cannot-be-undone look. */
  tone?: ConfirmTone;
}

/** What the dialog renders. Keys, not sentences — see the note on `ask()`. */
export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'params'>> {
  params?: MessageParams;
}

/**
 * Replaces `window.confirm()`. The browser dialog cannot be styled, cannot be
 * translated beyond the message text, blocks the JS thread, and on mobile
 * renders as an OS sheet that looks nothing like the product.
 *
 * The service only holds the pending request; `ConfirmDialog`, mounted once at
 * the app root, renders it.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly pending = signal<ConfirmRequest | null>(null);
  readonly request = this.pending.asReadonly();

  private resolvePending: ((confirmed: boolean) => void) | null = null;

  /**
   * Resolves `true` if the user confirms, `false` on cancel, Escape, or a click
   * on the backdrop.
   *
   * Takes translation keys rather than rendered strings so the dialog does the
   * formatting — the key is type-checked against the catalogue, and a caller
   * cannot accidentally hand it a hardcoded sentence.
   */
  ask(options: ConfirmOptions): Promise<boolean> {
    // A second question while one is open would otherwise leave the first
    // promise pending forever. Nothing in the UI does this today; it costs one
    // line to make it impossible.
    this.settle(false);

    this.pending.set({
      title: options.title,
      message: options.message,
      params: options.params,
      confirmLabel: options.confirmLabel ?? 'common.confirm',
      cancelLabel: options.cancelLabel ?? 'common.cancel',
      tone: options.tone ?? 'neutral',
    });

    return new Promise<boolean>((resolve) => {
      this.resolvePending = resolve;
    });
  }

  /** Called by the dialog. */
  respond(confirmed: boolean): void {
    this.pending.set(null);
    this.settle(confirmed);
  }

  private settle(confirmed: boolean): void {
    const resolve = this.resolvePending;
    this.resolvePending = null;
    resolve?.(confirmed);
  }
}
