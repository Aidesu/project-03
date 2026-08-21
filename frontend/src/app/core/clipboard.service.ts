import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/** How long a control keeps its "Copied ✓" label before returning to normal. */
const FEEDBACK_MS = 2000;

/**
 * Writes to the clipboard and remembers which control was used last, so a page
 * offering several copy buttons can confirm on the one that was actually
 * clicked instead of lighting them all up.
 *
 * Slots are opaque strings owned by the caller; prefix them with the id of the
 * record being copied so two pages cannot collide on a bare `subject`.
 */
@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private readonly doc = inject(DOCUMENT);
  private readonly lastCopied = signal<string | null>(null);
  private resetHandle: ReturnType<typeof setTimeout> | null = null;

  isCopied(slot: string): boolean {
    return this.lastCopied() === slot;
  }

  /**
   * Resolves `false` when the write failed — the caller is expected to tell the
   * user to select the text manually rather than to fail silently.
   */
  async copy(text: string, slot: string): Promise<boolean> {
    // Undefined on an insecure origin and in older browsers, so this is a
    // normal outcome, not a bug: `navigator.clipboard.writeText` would throw.
    const clipboard = this.doc.defaultView?.navigator.clipboard;
    if (!clipboard) return false;

    try {
      await clipboard.writeText(text);
    } catch {
      return false;
    }

    this.lastCopied.set(slot);
    // A second copy while the first confirmation is up must not be cleared by
    // the timer the first one scheduled.
    if (this.resetHandle) clearTimeout(this.resetHandle);
    this.resetHandle = setTimeout(() => this.lastCopied.set(null), FEEDBACK_MS);
    return true;
  }
}
