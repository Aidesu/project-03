import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '../locale';
import { formatMessage } from '../message-format';
import { dictionaries } from './index';

const KEYS = Object.keys(dictionaries.en) as (keyof typeof dictionaries.en)[];

/** Collects `{name}` and `{name, plural, …}` argument names from a message. */
function argumentsOf(message: string): Set<string> {
  const names = new Set<string>();
  const pattern = /\{\s*(\w+)\s*(?:,|\})/g;
  let match = pattern.exec(message);
  while (match !== null) {
    names.add(match[1]);
    match = pattern.exec(message);
  }
  return names;
}

describe('translation catalogues', () => {
  it('ships a catalogue for every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(dictionaries[locale], `missing catalogue for ${locale}`).toBeDefined();
    }
  });

  // The Record<TranslationKey, string> typing already enforces this at compile
  // time; the test guards against it being weakened later.
  it.each(SUPPORTED_LOCALES)('%s defines exactly the English key set', (locale) => {
    expect(Object.keys(dictionaries[locale]).sort()).toEqual([...KEYS].sort());
  });

  it.each(SUPPORTED_LOCALES)('%s has no empty message', (locale) => {
    const empty = KEYS.filter((key) => dictionaries[locale][key].trim() === '');
    expect(empty).toEqual([]);
  });

  /**
   * A translator dropping or renaming an argument is the classic i18n bug: the
   * message renders with a literal `{name}` in production and nowhere else.
   */
  it.each(SUPPORTED_LOCALES)('%s uses the same arguments as English', (locale) => {
    const mismatches = KEYS.filter((key) => {
      const expected = [...argumentsOf(dictionaries.en[key])].sort();
      const actual = [...argumentsOf(dictionaries[locale][key])].sort();
      return JSON.stringify(expected) !== JSON.stringify(actual);
    });
    expect(mismatches).toEqual([]);
  });

  it.each(SUPPORTED_LOCALES)('%s has balanced braces in every message', (locale) => {
    const unbalanced = KEYS.filter((key) => {
      const message = dictionaries[locale][key];
      let depth = 0;
      for (const char of message) {
        if (char === '{') depth += 1;
        else if (char === '}') depth -= 1;
        if (depth < 0) return true;
      }
      return depth !== 0;
    });
    expect(unbalanced).toEqual([]);
  });

  /**
   * Every plural message must resolve for the counts the UI actually renders,
   * and must not leak the ICU source into the output.
   */
  it.each(SUPPORTED_LOCALES)('%s resolves every plural message', (locale) => {
    const pluralKeys = KEYS.filter((key) => dictionaries[locale][key].includes(', plural,'));
    expect(pluralKeys.length).toBeGreaterThan(0);

    for (const key of pluralKeys) {
      const message = dictionaries[locale][key];
      const args = argumentsOf(message);
      for (const count of [0, 1, 2, 11]) {
        const params = Object.fromEntries([...args].map((name) => [name, count]));
        const rendered = formatMessage(message, params, locale);
        expect(rendered, `${locale}/${String(key)} @ ${count}`).not.toContain('plural,');
        expect(rendered, `${locale}/${String(key)} @ ${count}`).not.toContain('#');
      }
    }
  });

  /**
   * The typed confirmation word gates irreversible account deletion, and the
   * server only accepts a fixed allowlist — a word that drifts out of that list
   * would make deletion impossible for that language.
   */
  it('keeps the delete-confirmation word in the backend allowlist', () => {
    const accepted = new Set(['SUPPRIMER', 'DELETE', 'LÖSCHEN', 'ELIMINAR']);
    for (const locale of SUPPORTED_LOCALES) {
      expect(accepted).toContain(dictionaries[locale]['profile.danger.confirmWord']);
    }
  });
});
