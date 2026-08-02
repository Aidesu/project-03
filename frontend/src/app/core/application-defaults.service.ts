import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { currencyForLanguages, isCurrencyCode } from './currency';
import {
  EMPLOYMENT_TYPE_KEYS,
  SALARY_PERIOD_KEYS,
  SOURCE_KEYS,
  WORK_MODE_KEYS,
} from './enums';
import {
  ApplicationSource,
  EmploymentType,
  SalaryPeriod,
  WorkMode,
} from './models';

const STORAGE_KEY = 'jobquest.applicationDefaults';

/**
 * The fields a new application form is seeded with.
 *
 * Strictly how the user classifies a job, never anything about a specific one:
 * no company, no salary, no notes. This shape is the boundary — widening it
 * puts personal data in `localStorage`, on a machine that may be shared.
 */
export interface ApplicationDefaults {
  source: ApplicationSource | '';
  workMode: WorkMode | '';
  employmentType: EmploymentType | '';
  salaryPeriod: SalaryPeriod;
  salaryCurrency: string;
}

/** Value in the allowlist, or `''`. Own properties only — never the prototype. */
function pickEnum<T extends string>(
  allowed: Record<T, unknown>,
  value: unknown,
): T | '' {
  return typeof value === 'string' && Object.hasOwn(allowed, value)
    ? (value as T)
    : '';
}

/**
 * Remembers how the user classifies the jobs they apply to, so the tenth
 * application does not ask the same five questions as the first.
 *
 * Backed by `localStorage`: a UI convenience, unavailable in private mode
 * without consequence, and readable by anyone on the machine — which is why the
 * stored shape carries no personal data.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationDefaultsService {
  private readonly document = inject(DOCUMENT);

  /** Seed values for a new application. Never throws. */
  read(): ApplicationDefaults {
    const stored = this.readStored() ?? {};
    const storedCurrency = stored['salaryCurrency'];
    const currency =
      typeof storedCurrency === 'string' ? storedCurrency.toUpperCase() : null;

    return {
      source: pickEnum(SOURCE_KEYS, stored['source']),
      workMode: pickEnum(WORK_MODE_KEYS, stored['workMode']),
      employmentType: pickEnum(EMPLOYMENT_TYPE_KEYS, stored['employmentType']),
      salaryPeriod: pickEnum(SALARY_PERIOD_KEYS, stored['salaryPeriod']) || 'YEAR',
      salaryCurrency: isCurrencyCode(currency) ? currency : this.guessCurrency(),
    };
  }

  /** Records what was just submitted. Never throws, never blocks a save. */
  remember(values: ApplicationDefaults): void {
    // Re-normalized rather than trusted: `remember` is called with raw form
    // state, and what goes in is what `read` will hand back to a form control.
    const payload: ApplicationDefaults = {
      source: pickEnum(SOURCE_KEYS, values.source),
      workMode: pickEnum(WORK_MODE_KEYS, values.workMode),
      employmentType: pickEnum(EMPLOYMENT_TYPE_KEYS, values.employmentType),
      salaryPeriod: pickEnum(SALARY_PERIOD_KEYS, values.salaryPeriod) || 'YEAR',
      salaryCurrency: values.salaryCurrency.trim().toUpperCase(),
    };
    if (!isCurrencyCode(payload.salaryCurrency)) {
      payload.salaryCurrency = this.guessCurrency();
    }

    try {
      this.document.defaultView?.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // Storage can be unavailable or full. Defaults are a convenience.
    }
  }

  /** Forgets the stored defaults (used when clearing local state). */
  clear(): void {
    try {
      this.document.defaultView?.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* see remember() */
    }
  }

  /**
   * Parsed storage, treated as hostile: it survives across releases, is
   * editable by hand, and its values end up in a request body.
   */
  private readStored(): Record<string, unknown> | null {
    try {
      const raw = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private guessCurrency(): string {
    const navigator = this.document.defaultView?.navigator;
    const languages = navigator?.languages?.length
      ? navigator.languages
      : navigator?.language
        ? [navigator.language]
        : [];
    return currencyForLanguages(languages);
  }
}
