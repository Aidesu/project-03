import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ApplicationDefaults,
  ApplicationDefaultsService,
} from './application-defaults.service';

const KEY = 'jobquest.applicationDefaults';

/** Minimal `localStorage`, so a test can also make it throw. */
function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    read: (key: string) => data.get(key) ?? null,
  };
}

function setup(
  localStorage: unknown,
  languages: readonly string[] = ['fr-FR'],
): ApplicationDefaultsService {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: DOCUMENT,
        useValue: {
          defaultView: {
            localStorage,
            navigator: { languages, language: languages[0] },
          },
        },
      },
    ],
  });
  return TestBed.inject(ApplicationDefaultsService);
}

describe('ApplicationDefaultsService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('falls back to a currency guessed from the browser region', () => {
    expect(setup(storage(), ['en-GB']).read().salaryCurrency).toBe('GBP');
    TestBed.resetTestingModule();
    expect(setup(storage(), ['fr-FR']).read().salaryCurrency).toBe('EUR');
  });

  it('skips region-less tags and uses the first one that carries a region', () => {
    expect(setup(storage(), ['en', 'en-CA']).read().salaryCurrency).toBe('CAD');
  });

  it('falls back to EUR for an unmapped or malformed region', () => {
    expect(setup(storage(), ['xx-QQ', 'not a tag']).read().salaryCurrency).toBe(
      'EUR',
    );
  });

  it('round-trips what was remembered', () => {
    const store = storage();
    const service = setup(store);
    const values: ApplicationDefaults = {
      source: 'LINKEDIN',
      workMode: 'REMOTE',
      employmentType: 'FULL_TIME',
      salaryPeriod: 'MONTH',
      salaryCurrency: 'chf',

    };
    service.remember(values);

    expect(service.read()).toEqual({
      source: 'LINKEDIN',
      workMode: 'REMOTE',
      employmentType: 'FULL_TIME',
      salaryPeriod: 'MONTH',
      salaryCurrency: 'CHF',
    });
  });

  // Storage survives releases and is editable by hand; whatever comes back
  // lands in a form control and then in a request body.
  it('drops values that are not in the allowlist', () => {
    const service = setup(
      storage({
        [KEY]: JSON.stringify({
          source: 'NOT_A_SOURCE',
          workMode: { evil: true },
          employmentType: 42,
          salaryPeriod: 'CENTURY',
          salaryCurrency: 'EURO',
        }),
      }),
    );

    expect(service.read()).toEqual({
      source: '',
      workMode: '',
      employmentType: '',
      salaryPeriod: 'YEAR',
      salaryCurrency: 'EUR',
    });
  });

  it('ignores inherited properties rather than reading the prototype', () => {
    const service = setup(
      storage({ [KEY]: '{"source":"constructor","workMode":"toString"}' }),
    );
    expect(service.read().source).toBe('');
    expect(service.read().workMode).toBe('');
  });

  it('survives unparseable storage', () => {
    const service = setup(storage({ [KEY]: 'not json at all' }));
    expect(service.read().source).toBe('');
  });

  it('never lets an unavailable storage break a save', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const service = setup(blocked);

    expect(() =>
      service.remember({
        source: 'LINKEDIN',
        workMode: '',
        employmentType: '',
        salaryPeriod: 'YEAR',
        salaryCurrency: 'EUR',
      }),
    ).not.toThrow();
    expect(() => service.clear()).not.toThrow();
    expect(service.read().source).toBe('');
  });

  it('forgets everything on clear', () => {
    const store = storage();
    const service = setup(store);
    service.remember({
      source: 'REFERRAL',
      workMode: '',
      employmentType: '',
      salaryPeriod: 'YEAR',
      salaryCurrency: 'EUR',
    });
    service.clear();

    expect(store.read(KEY)).toBeNull();
    expect(service.read().source).toBe('');
  });
});
