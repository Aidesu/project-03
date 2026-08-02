import { describe, expect, it } from 'vitest';
import { formatMessage } from './message-format';

describe('formatMessage', () => {
  it('returns a message without placeholders untouched', () => {
    expect(formatMessage('Applications', undefined, 'en')).toBe('Applications');
  });

  it('interpolates simple arguments', () => {
    expect(formatMessage('Hi {name} 👋', { name: 'Carla' }, 'en')).toBe('Hi Carla 👋');
  });

  it('interpolates the same argument more than once', () => {
    expect(formatMessage('{a}-{b}-{a}', { a: '1', b: '2' }, 'en')).toBe('1-2-1');
  });

  // A missing argument must stay visible rather than silently rendering an
  // empty gap that nobody notices in QA.
  it('leaves an unsupplied argument as its literal placeholder', () => {
    expect(formatMessage('Hi {name}', {}, 'en')).toBe('Hi {name}');
  });

  it('selects the plural branch and substitutes # with the count', () => {
    const message = '{count, plural, one {# application} other {# applications}}';
    expect(formatMessage(message, { count: 1 }, 'en')).toBe('1 application');
    expect(formatMessage(message, { count: 7 }, 'en')).toBe('7 applications');
  });

  // French puts 0 in the "one" category, English and German do not — this is
  // exactly why plural category selection is delegated to Intl.PluralRules
  // instead of a hand-rolled `n === 1` check.
  it('follows each locale plural rules for zero', () => {
    const fr = '{count, plural, one {# candidature} other {# candidatures}}';
    const en = '{count, plural, one {# application} other {# applications}}';
    expect(formatMessage(fr, { count: 0 }, 'fr')).toBe('0 candidature');
    expect(formatMessage(en, { count: 0 }, 'en')).toBe('0 applications');
  });

  it('prefers an exact-value branch over the plural category', () => {
    const message = '{count, plural, =0 {nothing} one {# item} other {# items}}';
    expect(formatMessage(message, { count: 0 }, 'en')).toBe('nothing');
    expect(formatMessage(message, { count: 2 }, 'en')).toBe('2 items');
  });

  it('formats the count in # according to the locale', () => {
    const message = '{count, plural, one {# item} other {# items}}';
    // Both locales group thousands, but with different separators.
    expect(formatMessage(message, { count: 12345 }, 'en')).toBe('12,345 items');
    expect(formatMessage(message, { count: 12345 }, 'de')).toBe('12.345 items');
  });

  it('combines plural and simple arguments in one message', () => {
    const message = '{count, plural, one {# application} other {# applications}} — {date}';
    expect(formatMessage(message, { count: 2, date: '3 May' }, 'en')).toBe(
      '2 applications — 3 May',
    );
  });

  it('handles two plural arguments in the same message', () => {
    const message =
      '{a, plural, one {# app} other {# apps}} and {b, plural, one {# contact} other {# contacts}}';
    expect(formatMessage(message, { a: 1, b: 3 }, 'en')).toBe('1 app and 3 contacts');
  });

  it('supports select branches with an other fallback', () => {
    const message = '{mode, select, REMOTE {Remote} ON_SITE {On site} other {Unknown}}';
    expect(formatMessage(message, { mode: 'REMOTE' }, 'en')).toBe('Remote');
    expect(formatMessage(message, { mode: 'HYBRID' }, 'en')).toBe('Unknown');
  });

  it('unescapes doubled apostrophes', () => {
    expect(formatMessage("aujourd''hui", undefined, 'fr')).toBe("aujourd'hui");
  });

  // Degrade to visible-but-wrong text: a malformed translation must never
  // throw and blank the page that renders it.
  it('leaves an unbalanced brace as literal text instead of throwing', () => {
    expect(formatMessage('Hi {name', { name: 'X' }, 'en')).toBe('Hi {name');
  });

  it('keeps an unknown argument type verbatim', () => {
    expect(formatMessage('{n, currency, EUR}', { n: 5 }, 'en')).toBe('{n, currency, EUR}');
  });

  it('renders a non-numeric plural argument as its placeholder', () => {
    const message = '{count, plural, one {# item} other {# items}}';
    expect(formatMessage(message, { count: 'abc' }, 'en')).toBe('{count}');
  });

  // The email-template placeholders are literal `{{token}}` strings passed as
  // arguments; they must survive interpolation unchanged.
  it('passes through a value that itself looks like a placeholder', () => {
    expect(formatMessage('Hello {who},', { who: '{{contact_prenom}}' }, 'en')).toBe(
      'Hello {{contact_prenom}},',
    );
  });
});
