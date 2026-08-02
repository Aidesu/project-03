import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DEFAULT_LOCALE, Locale, directionOf, isLocale, negotiateLocale } from './locale';
import { MessageParams, formatMessage } from './message-format';
import { TranslationKey, dictionaries } from './translations';

/**
 * Survives a reload for anonymous visitors (login/register) and gives the
 * authenticated app its language before `/auth/me` answers, avoiding a flash of
 * the wrong language. The server-side `UserSettings.locale` stays the source of
 * truth and overwrites this as soon as the session is restored.
 */
const STORAGE_KEY = 'jobquest.locale';

/** Signature of the bound `t` a component exposes to its template. */
export type Translate = (key: TranslationKey, params?: MessageParams) => string;

/** An arbitrary Monday, used to enumerate weekday names in order. */
const REFERENCE_MONDAY = Date.UTC(2024, 0, 1);

/** Falls back to UTC when the platform cannot resolve a zone (never throws). */
function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);

  private readonly _locale = signal<Locale>(this.initialLocale());
  readonly locale = this._locale.asReadonly();

  /**
   * IANA zone used for every date rendered to this user. Timestamps are stored
   * and transported in UTC; this is the only place they become local.
   */
  private readonly _timezone = signal<string>(browserTimezone());
  readonly timezone = this._timezone.asReadonly();

  private readonly messages = computed(() => dictionaries[this._locale()]);

  constructor() {
    // Keeps assistive tech, hyphenation and `:lang()` rules in sync with the
    // language actually rendered.
    effect(() => {
      const locale = this._locale();
      const root = this.document.documentElement;
      root.setAttribute('lang', locale);
      root.setAttribute('dir', directionOf(locale));
    });
  }

  /**
   * Translates `key`, interpolating `params` through the ICU subset.
   *
   * Bound as a field, not a method, so a component can expose it directly
   * (`protected readonly t = inject(I18nService).t`) and templates stay
   * readable. Reading `messages()` inside the template's reactive context is
   * what makes every translated string re-render on a locale change.
   */
  readonly t = (key: TranslationKey, params?: MessageParams): string => {
    const locale = this._locale();
    const message = this.messages()[key] ?? dictionaries.en[key];
    // A key missing from every dictionary is a bug, not a runtime failure:
    // render the key so it is obvious in QA rather than blanking the UI.
    if (message === undefined) return key;
    return formatMessage(message, params, locale);
  };

  /** Applies a user's stored preferences (called once the session is known). */
  applySettings(settings: { locale?: string | null; timezone?: string | null }): void {
    if (isLocale(settings.locale)) this.setLocale(settings.locale);
    if (settings.timezone) this._timezone.set(settings.timezone);
  }

  setLocale(locale: Locale): void {
    if (!isLocale(locale) || locale === this._locale()) return;
    this._locale.set(locale);
    this.persist(locale);
  }

  /** Drops the anonymous preference so the next visitor is renegotiated. */
  reset(): void {
    this._timezone.set(browserTimezone());
  }

  // ---- Locale-aware formatting -----------------------------------------
  // All of these take the ISO-8601 UTC strings the API returns and render them
  // in the user's zone. `null` in, em dash out — every caller displays a
  // placeholder for a missing date, so centralise it here.

  readonly date = (value: string | Date | null | undefined): string =>
    this.format(value, { dateStyle: 'short' });

  readonly dateLong = (value: string | Date | null | undefined): string =>
    this.format(value, { dateStyle: 'long' });

  readonly dateTime = (value: string | Date | null | undefined): string =>
    this.format(value, { dateStyle: 'short', timeStyle: 'short' });

  readonly monthShort = (value: string | Date | null | undefined): string =>
    this.format(value, { month: 'short' });

  readonly weekdayShort = (value: string | Date | null | undefined): string =>
    this.format(value, { weekday: 'short' });

  readonly dayMonth = (value: string | Date | null | undefined): string =>
    this.format(value, { day: 'numeric', month: 'short' });

  readonly weekdayDayMonth = (value: string | Date | null | undefined): string =>
    this.format(value, { weekday: 'long', day: 'numeric', month: 'long' });

  /**
   * Formats a calendar day (`YYYY-MM-DD`) — a date with no time component, such
   * as a daily statistics bucket. Always rendered in UTC: applying the user's
   * zone here would shift the label onto the neighbouring day.
   */
  readonly calendarDay = (
    isoDay: string,
    options: Intl.DateTimeFormatOptions,
  ): string => {
    const date = new Date(`${isoDay}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return isoDay;
    return new Intl.DateTimeFormat(this._locale(), {
      ...options,
      timeZone: 'UTC',
    }).format(date);
  };

  readonly calendarWeekdayShort = (isoDay: string): string =>
    this.calendarDay(isoDay, { weekday: 'short' });

  readonly calendarMonthShort = (isoDay: string): string =>
    this.calendarDay(isoDay, { month: 'short' });

  readonly calendarFull = (isoDay: string): string =>
    this.calendarDay(isoDay, { weekday: 'long', day: 'numeric', month: 'long' });

  /**
   * The seven weekday names, Monday first, in the active locale. Formatted in
   * UTC on purpose: these are calendar labels, not instants, so the user's zone
   * must not shift them onto the neighbouring day.
   */
  readonly weekdayNames = (
    format: 'short' | 'long' | 'narrow' = 'short',
  ): string[] => {
    const formatter = new Intl.DateTimeFormat(this._locale(), {
      weekday: format,
      timeZone: 'UTC',
    });
    return Array.from({ length: 7 }, (_, i) =>
      formatter.format(new Date(REFERENCE_MONDAY + i * 86_400_000)),
    );
  };

  readonly number = (value: number, options?: Intl.NumberFormatOptions): string =>
    new Intl.NumberFormat(this._locale(), options).format(value);

  /**
   * Money is carried as integer minor units plus an ISO-4217 code — never a
   * float — and the fraction digits come from the currency, not from us.
   */
  readonly money = (minorUnits: number, currency: string): string => {
    const formatter = new Intl.NumberFormat(this._locale(), {
      style: 'currency',
      currency,
    });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(minorUnits / 10 ** digits);
  };

  private format(
    value: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions,
  ): string {
    if (value === null || value === undefined || value === '') return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(this._locale(), {
      ...options,
      timeZone: this._timezone(),
    }).format(date);
  }

  // ---- Persistence ------------------------------------------------------

  private initialLocale(): Locale {
    const stored = this.readStored();
    if (stored) return stored;

    const navigatorLanguages =
      this.document.defaultView?.navigator?.languages ?? [];
    return negotiateLocale(navigatorLanguages, DEFAULT_LOCALE);
  }

  private readStored(): Locale | null {
    try {
      const value = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      return isLocale(value) ? value : null;
    } catch {
      // Storage can be unavailable (private mode, blocked cookies) — the
      // language preference is a convenience, never a hard requirement.
      return null;
    }
  }

  private persist(locale: Locale): void {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* see readStored() */
    }
  }
}
