import { Directive, output } from '@angular/core';

/**
 * Emits when the backdrop it sits on is clicked, and only then.
 *
 * A plain `(click)` on a backdrop also fires when a drag starts inside the
 * dialog and ends outside it — selecting text with the mouse, typically —
 * because the click event lands on the nearest common ancestor. That closed
 * the dialog and destroyed the selection the user was making. Both ends of the
 * gesture must therefore land on the backdrop itself.
 */
@Directive({
  selector: '[appBackdropDismiss]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(click)': 'onClick($event)',
  },
})
export class BackdropDismiss {
  readonly dismissed = output<void>();

  private pressedOnBackdrop = false;
  private releasedOnBackdrop = false;

  protected onPointerDown(event: PointerEvent): void {
    this.pressedOnBackdrop = event.target === event.currentTarget;
  }

  protected onPointerUp(event: PointerEvent): void {
    this.releasedOnBackdrop = event.target === event.currentTarget;
  }

  protected onClick(event: MouseEvent): void {
    const onBackdrop =
      this.pressedOnBackdrop &&
      this.releasedOnBackdrop &&
      event.target === event.currentTarget;
    this.pressedOnBackdrop = false;
    this.releasedOnBackdrop = false;
    if (onBackdrop) this.dismissed.emit();
  }
}
