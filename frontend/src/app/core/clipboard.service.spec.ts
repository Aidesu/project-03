import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClipboardService } from './clipboard.service';

function setup(options: { writeText?: (text: string) => Promise<void>; clipboard?: unknown } = {}) {
  const writes: string[] = [];
  const writeText =
    options.writeText ??
    ((text: string) => {
      writes.push(text);
      return Promise.resolve();
    });

  const clipboard = 'clipboard' in options ? options.clipboard : { writeText };

  TestBed.configureTestingModule({
    providers: [
      {
        provide: DOCUMENT,
        useValue: { defaultView: { navigator: { clipboard } } },
      },
    ],
  });

  return { service: TestBed.inject(ClipboardService), writes };
}

describe('ClipboardService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('writes the text and confirms on the slot that was used', async () => {
    const { service, writes } = setup();

    await expect(service.copy('Hello', 'a:subject')).resolves.toBe(true);

    expect(writes).toEqual(['Hello']);
    expect(service.isCopied('a:subject')).toBe(true);
  });

  // The whole point of slots: two buttons on one row must not both light up.
  it('confirms on one slot at a time', async () => {
    const { service } = setup();

    await service.copy('Subject', 'a:subject');
    await service.copy('Body', 'a:body');

    expect(service.isCopied('a:subject')).toBe(false);
    expect(service.isCopied('a:body')).toBe(true);
  });

  it('clears the confirmation after the feedback delay', async () => {
    const { service } = setup();

    await service.copy('Hello', 'a:subject');
    vi.advanceTimersByTime(2000);

    expect(service.isCopied('a:subject')).toBe(false);
  });

  // A second copy inherits the first one's pending timer if it is not cleared,
  // so the confirmation would vanish early.
  it('restarts the delay on a second copy', async () => {
    const { service } = setup();

    await service.copy('Subject', 'a:subject');
    vi.advanceTimersByTime(1500);
    await service.copy('Body', 'a:body');
    vi.advanceTimersByTime(1500);

    expect(service.isCopied('a:body')).toBe(true);
  });

  it('reports failure instead of throwing when the write is rejected', async () => {
    const { service } = setup({ writeText: () => Promise.reject(new Error('denied')) });

    await expect(service.copy('Hello', 'a:subject')).resolves.toBe(false);
    expect(service.isCopied('a:subject')).toBe(false);
  });

  // `navigator.clipboard` is absent on an insecure origin — a normal outcome
  // the caller has to surface, not a crash.
  it('reports failure when the clipboard API is unavailable', async () => {
    const { service } = setup({ clipboard: undefined });

    await expect(service.copy('Hello', 'a:subject')).resolves.toBe(false);
  });
});
