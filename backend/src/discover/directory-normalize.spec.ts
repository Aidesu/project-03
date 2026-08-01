import { normalizeCompanyName, normalizeWebsiteDomain } from './directory-normalize';

describe('normalizeWebsiteDomain', () => {
  it('strips protocol, www, and path', () => {
    expect(normalizeWebsiteDomain('https://www.Doctolib.fr/careers')).toBe('doctolib.fr');
  });

  it('accepts a bare domain with no protocol', () => {
    expect(normalizeWebsiteDomain('doctolib.fr')).toBe('doctolib.fr');
  });

  it('returns null for missing input', () => {
    expect(normalizeWebsiteDomain(null)).toBeNull();
    expect(normalizeWebsiteDomain(undefined)).toBeNull();
    expect(normalizeWebsiteDomain('')).toBeNull();
  });

  it('returns null instead of throwing on unparseable input', () => {
    expect(normalizeWebsiteDomain('not a url at all !!')).toBeNull();
  });
});

describe('normalizeCompanyName', () => {
  it('lowercases, trims, and collapses internal whitespace', () => {
    expect(normalizeCompanyName('  Doctolib   SAS ')).toBe('doctolib sas');
  });

  it('strips accents so equivalent names match', () => {
    expect(normalizeCompanyName('Société Générale')).toBe('societe generale');
    expect(normalizeCompanyName('SOCIETE GENERALE')).toBe('societe generale');
  });
});
