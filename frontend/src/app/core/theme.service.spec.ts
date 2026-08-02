import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme.service';

const KEY = 'jobquest.theme';

function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    read: (key: string) => data.get(key) ?? null,
  };
}

/** Captures the media listener so a test can fire an OS theme change. */
function setup(options: { stored?: string; systemDark?: boolean; localStorage?: unknown } = {}) {
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  const root = {
    attributes: new Map<string, string>(),
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    },
    style: { colorScheme: '' },
  };
  const store =
    options.localStorage ??
    storage(options.stored ? { [KEY]: options.stored } : {});

  TestBed.configureTestingModule({
    providers: [
      {
        provide: DOCUMENT,
        useValue: {
          documentElement: root,
          defaultView: {
            localStorage: store,
            matchMedia: () => ({
              matches: options.systemDark ?? false,
              addEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
                listeners.push(fn),
            }),
          },
        },
      },
    ],
  });

  const service = TestBed.inject(ThemeService);
  // Flush the effect that writes the attribute.
  TestBed.tick();
  return { service, root, store: store as ReturnType<typeof storage>, listeners };
}

describe('ThemeService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('follows the system until the user decides otherwise', () => {
    const { service, root } = setup({ systemDark: true });
    expect(service.preference()).toBe('system');
    expect(service.isDark()).toBe(true);
    expect(root.attributes.get('data-theme')).toBe('dark');
  });

  it('honours a stored choice over the system', () => {
    const { service } = setup({ stored: 'light', systemDark: true });
    expect(service.isDark()).toBe(false);
  });

  it('writes the attribute and the colour scheme on every change', () => {
    const { service, root } = setup();
    service.toggle();
    TestBed.tick();
    expect(root.attributes.get('data-theme')).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('commits an explicit preference when toggled', () => {
    const { service, store } = setup({ systemDark: true });
    service.toggle();
    expect(service.preference()).toBe('light');
    expect(store.read(KEY)).toBe('light');
  });

  // `system` has to stay live: the OS can flip at sunset with the app open.
  it('tracks the system while no explicit choice was made', () => {
    const { service, listeners } = setup({ systemDark: false });
    expect(service.isDark()).toBe(false);
    listeners.forEach((fn) => fn({ matches: true }));
    expect(service.isDark()).toBe(true);
  });

  it('stops tracking the system once a choice is made', () => {
    const { service, listeners } = setup({ systemDark: false });
    service.set('light');
    listeners.forEach((fn) => fn({ matches: true }));
    expect(service.isDark()).toBe(false);
  });

  it('ignores a stored value that is not a preference', () => {
    const { service } = setup({ stored: 'neon' });
    expect(service.preference()).toBe('system');
  });

  it('still applies a theme when storage is unavailable', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const { service, root } = setup({ localStorage: blocked });
    expect(service.preference()).toBe('system');
    expect(() => service.toggle()).not.toThrow();
    TestBed.tick();
    expect(root.attributes.get('data-theme')).toBe('dark');
  });
});
