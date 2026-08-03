import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfirmService } from '../../core/confirm.service';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let fixture: ComponentFixture<ConfirmDialog>;
  let confirm: ConfirmService;

  const el = () => fixture.nativeElement as HTMLElement;
  const panel = () => el().querySelector('[role="alertdialog"]');
  const buttons = () => [...el().querySelectorAll<HTMLButtonElement>('button')];
  const cancelButton = () => buttons()[0];
  const confirmButton = () => buttons()[1];

  const backdrop = () => el().firstElementChild as HTMLElement;

  /**
   * A full pointer gesture. `click` fires on the nearest common ancestor of
   * press and release, which is what makes a press-inside/release-outside drag
   * look like a backdrop click.
   */
  const drag = (from: HTMLElement, to: HTMLElement) => {
    from.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    to.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    (from === to ? from : backdrop()).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
  };

  const press = (key: string, shiftKey = false) =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfirmDialog] });
    confirm = TestBed.inject(ConfirmService);
    fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
  });

  const open = (tone: 'danger' | 'neutral' = 'danger') => {
    const answer = confirm.ask({
      title: 'network.confirmDeleteContact.title',
      message: 'network.confirmDeleteContact.body',
      params: { name: 'Ada Lovelace' },
      confirmLabel: 'common.delete',
      tone,
    });
    fixture.detectChanges();
    return answer;
  };

  it('renders nothing until something is asked', () => {
    expect(panel()).toBeNull();
  });

  it('renders the translated question and its consequence', () => {
    open();
    const text = el().textContent ?? '';
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('lose this link');
  });

  it('resolves true when confirmed', async () => {
    const answer = open();
    confirmButton().click();
    fixture.detectChanges();

    await expect(answer).resolves.toBe(true);
    expect(panel()).toBeNull();
  });

  it('resolves false when cancelled', async () => {
    const answer = open();
    cancelButton().click();
    fixture.detectChanges();

    await expect(answer).resolves.toBe(false);
  });

  // Dismissing without choosing must mean "no". A dialog that resolved true on
  // Escape would delete things people were trying to back out of.
  it('resolves false on Escape', async () => {
    const answer = open();
    press('Escape');
    fixture.detectChanges();

    await expect(answer).resolves.toBe(false);
    expect(panel()).toBeNull();
  });

  it('resolves false when the backdrop is clicked', async () => {
    const answer = open();
    drag(backdrop(), backdrop());
    fixture.detectChanges();

    await expect(answer).resolves.toBe(false);
  });

  it('keeps the dialog open when the panel itself is clicked', () => {
    open();
    drag(panel() as HTMLElement, panel() as HTMLElement);
    fixture.detectChanges();

    expect(panel()).not.toBeNull();
  });

  // Selecting text inside the dialog and releasing past its edge is not a
  // dismissal: it used to close the dialog and throw the selection away.
  it('keeps the dialog open when a drag starts inside and ends on the backdrop', () => {
    open();
    drag(panel() as HTMLElement, backdrop());
    fixture.detectChanges();

    expect(panel()).not.toBeNull();
  });

  // An Enter keypress already in flight when the dialog appears must not be
  // the thing that destroys data.
  it('focuses cancel, not the destructive action', () => {
    open('danger');
    expect(document.activeElement).toBe(cancelButton());
  });

  it('focuses the confirm action for a non-destructive question', () => {
    open('neutral');
    expect(document.activeElement).toBe(confirmButton());
  });

  it('wraps Tab around the dialog instead of leaking into the page', () => {
    open('danger');

    confirmButton().focus();
    press('Tab');
    expect(document.activeElement).toBe(cancelButton());

    cancelButton().focus();
    press('Tab', true);
    expect(document.activeElement).toBe(confirmButton());
  });

  it('gives focus back to whatever opened it', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    const answer = open();
    expect(document.activeElement).not.toBe(trigger);

    cancelButton().click();
    fixture.detectChanges();
    await answer;

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('announces itself as a dialog awaiting an answer', () => {
    open();
    const dialog = panel() as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-dialog-title');
    expect(dialog.getAttribute('aria-describedby')).toBe(
      'confirm-dialog-message',
    );
  });

  // Nothing does this today; leaving the first promise pending forever would
  // hang whichever action was waiting on it.
  it('settles an outstanding question as cancelled when a second one opens', async () => {
    const first = open();
    const second = open();

    await expect(first).resolves.toBe(false);

    confirmButton().click();
    fixture.detectChanges();
    await expect(second).resolves.toBe(true);
  });

  it('ignores keystrokes when nothing is being asked', async () => {
    const answer = open();
    cancelButton().click();
    fixture.detectChanges();
    await answer;

    expect(() => press('Escape')).not.toThrow();
  });
});
