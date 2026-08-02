import { validateEnv } from './env.validation';

const STRONG_A = 'a'.repeat(48);
const STRONG_B = 'b'.repeat(48);
const STRONG_C = 'c'.repeat(48);

const baseProd = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@db:5432/app',
  CORS_ORIGIN: 'https://app.example.com',
  JWT_ACCESS_SECRET: STRONG_A,
  JWT_REFRESH_SECRET: STRONG_B,
  CSRF_SECRET: STRONG_C,
};

describe('validateEnv', () => {
  it('accepts a well-formed production configuration', () => {
    expect(() => validateEnv({ ...baseProd })).not.toThrow();
  });

  it('accepts development defaults without the production-only rules', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://u:p@localhost:5432/app',
        CORS_ORIGIN: 'http://localhost:4200',
        JWT_ACCESS_SECRET: 'change-me-access-secret',
        JWT_REFRESH_SECRET: 'change-me-refresh-secret',
        CSRF_SECRET: 'change-me-csrf-secret',
      }),
    ).not.toThrow();
  });

  it('refuses to boot without a database URL', () => {
    const { DATABASE_URL, ...rest } = baseProd;
    void DATABASE_URL;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('refuses placeholder secrets in production', () => {
    expect(() =>
      validateEnv({ ...baseProd, CSRF_SECRET: 'change-me-csrf-secret' }),
    ).toThrow(/placeholder/);
  });

  it('refuses short secrets in production', () => {
    expect(() =>
      validateEnv({ ...baseProd, JWT_ACCESS_SECRET: 'short' }),
    ).toThrow(/at least 32 characters/);
  });

  // A secret reused across purposes turns a leak in the weakest context into a
  // compromise of token signing.
  it('refuses a secret reused across two purposes', () => {
    expect(() => validateEnv({ ...baseProd, CSRF_SECRET: STRONG_A })).toThrow(
      /never reuse a secret/,
    );
  });

  it('refuses a wildcard or plaintext CORS origin in production', () => {
    expect(() => validateEnv({ ...baseProd, CORS_ORIGIN: '*' })).toThrow(
      /cannot be "\*"/,
    );
    expect(() =>
      validateEnv({ ...baseProd, CORS_ORIGIN: 'http://app.example.com' }),
    ).toThrow(/https/);
    expect(() => validateEnv({ ...baseProd, CORS_ORIGIN: '' })).toThrow(
      /CORS_ORIGIN is required/,
    );
  });

  // A bad hop count is a security bug, not a typo: too high and any client can
  // forge X-Forwarded-For to dodge rate limits.
  it('refuses a non-integer or out-of-range proxy hop count', () => {
    for (const hops of ['yes', '-1', '11', '1.5']) {
      expect(() =>
        validateEnv({ ...baseProd, TRUSTED_PROXY_HOPS: hops }),
      ).toThrow(/TRUSTED_PROXY_HOPS/);
    }
    expect(() =>
      validateEnv({ ...baseProd, TRUSTED_PROXY_HOPS: '1' }),
    ).not.toThrow();
  });

  it('reports every problem at once rather than one per restart', () => {
    let message = '';
    try {
      validateEnv({ NODE_ENV: 'production' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('JWT_ACCESS_SECRET');
    expect(message).toContain('CORS_ORIGIN');
  });
});
