import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nService } from './i18n.service';
import { DEFAULT_LOCALE, negotiateLocale } from './locale';

describe('negotiateLocale', () => {
  it('matches on the primary subtag', () => {
    expect(negotiateLocale(['de-AT', 'en-US'])).toBe('de');
  });

  it('takes the first supported entry, in order of preference', () => {
    expect(negotiateLocale(['pt-BR', 'en-GB', 'fr'])).toBe('en');
  });

  it('falls back when nothing is supported', () => {
    expect(negotiateLocale(['ja', 'ko'])).toBe(DEFAULT_LOCALE);
  });
});

describe('I18nService', () => {
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    i18n = TestBed.inject(I18nService);
    i18n.setLocale('en');
  });

  it('translates a key in the active locale', () => {
    expect(i18n.t('common.save')).toBe('Save');
    i18n.setLocale('de');
    expect(i18n.t('common.save')).toBe('Speichern');
    i18n.setLocale('fr');
    expect(i18n.t('common.save')).toBe('Enregistrer');
  });

  it('interpolates parameters', () => {
    expect(i18n.t('common.pageOf', { page: 2, pageCount: 5 })).toBe('Page 2 / 5');
  });

  it('reflects the locale in <html lang>', () => {
    i18n.setLocale('de');
    TestBed.tick();
    expect(document.documentElement.getAttribute('lang')).toBe('de');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('persists the choice so a reload keeps the language', () => {
    i18n.setLocale('de');
    expect(localStorage.getItem('jobquest.locale')).toBe('de');
  });

  // An attacker-controlled or stale value must not select a missing catalogue.
  it('ignores an unsupported locale', () => {
    i18n.setLocale('en');
    i18n.applySettings({ locale: 'xx' });
    expect(i18n.locale()).toBe('en');
  });

  it('adopts the locale and zone carried by the session', () => {
    i18n.applySettings({ locale: 'de', timezone: 'Asia/Tokyo' });
    expect(i18n.locale()).toBe('de');
    expect(i18n.timezone()).toBe('Asia/Tokyo');
  });

  describe('date formatting', () => {
    // 22:30 UTC is already the next day in Tokyo: the point of storing UTC and
    // converting at the presentation layer only.
    it('renders a UTC instant in the user zone', () => {
      i18n.applySettings({ locale: 'en', timezone: 'Asia/Tokyo' });
      expect(i18n.date('2026-03-01T22:30:00Z')).toBe('3/2/26');

      i18n.applySettings({ timezone: 'UTC' });
      expect(i18n.date('2026-03-01T22:30:00Z')).toBe('3/1/26');
    });

    it('uses the locale conventions for order and separators', () => {
      i18n.applySettings({ locale: 'fr', timezone: 'Europe/Paris' });
      expect(i18n.date('2026-03-01T12:00:00Z')).toBe('01/03/2026');
      i18n.setLocale('de');
      expect(i18n.date('2026-03-01T12:00:00Z')).toBe('01.03.26');
    });

    it('shows a placeholder for a missing or invalid date', () => {
      expect(i18n.date(null)).toBe('—');
      expect(i18n.date('not-a-date')).toBe('—');
    });

    // Calendar days have no time component, so the user's zone must not drag
    // them onto the neighbouring day.
    it('formats a calendar day in UTC regardless of the user zone', () => {
      i18n.applySettings({ locale: 'en', timezone: 'Pacific/Auckland' });
      expect(i18n.calendarDay('2026-03-01', { day: 'numeric', month: 'numeric' })).toBe(
        '3/1',
      );
    });

    it('lists weekday names Monday-first in the active locale', () => {
      i18n.setLocale('fr');
      const names = i18n.weekdayNames('long');
      expect(names).toHaveLength(7);
      expect(names[0]).toBe('lundi');
      expect(names[6]).toBe('dimanche');
    });
  });

  describe('number formatting', () => {
    it('groups digits per locale', () => {
      i18n.setLocale('en');
      expect(i18n.number(1234567)).toBe('1,234,567');
      i18n.setLocale('de');
      expect(i18n.number(1234567)).toBe('1.234.567');
    });

    // Money is carried as integer minor units; the fraction digits come from
    // the currency, so a zero-decimal currency must not gain cents.
    it('renders minor units with the currency own precision', () => {
      i18n.setLocale('en');
      expect(i18n.money(123456, 'USD')).toBe('$1,234.56');
      expect(i18n.money(1234, 'JPY')).toBe('¥1,234');
    });
  });
});
