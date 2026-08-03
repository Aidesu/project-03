/**
 * Boot-time environment validation, wired into `ConfigModule.forRoot({ validate })`.
 *
 * Fails fast so the app never starts in a misconfigured (especially insecure)
 * state: missing secrets, weak/duplicated secrets, placeholder values in
 * production, or a proxy setting that would break IP-based rate limiting.
 */

// 32 bytes of entropy, base64url-encoded, is ~43 chars. Anything shorter is
// either a truncated secret or a human-chosen passphrase — reject both.
const MIN_SECRET_LENGTH = 32;

const SECRET_KEYS = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CSRF_SECRET',
  'EMAIL_TOKEN_SECRET',
] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const isProd = config.NODE_ENV === 'production';
  const errors: string[] = [];

  if (!config.DATABASE_URL) errors.push('DATABASE_URL is required.');

  const seen = new Map<string, string>();
  for (const key of SECRET_KEYS) {
    const value = config[key];
    if (typeof value !== 'string' || value.length === 0) {
      errors.push(`${key} is required.`);
      continue;
    }
    if (isProd && value.startsWith('change-me')) {
      errors.push(
        `${key} is still the placeholder value. Set a strong secret.`,
      );
      continue;
    }
    if (isProd && value.length < MIN_SECRET_LENGTH) {
      errors.push(
        `${key} must be at least ${MIN_SECRET_LENGTH} characters. Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
      );
    }
    // Reusing one secret across purposes means a leak in any one context
    // (e.g. the CSRF token, which is readable by JS by design) compromises
    // token signing too.
    const previous = seen.get(value);
    if (previous) {
      errors.push(
        `${key} must differ from ${previous} — never reuse a secret.`,
      );
    } else {
      seen.set(value, key);
    }
  }

  // Number of reverse proxies in front of the app. Wrong values are a real
  // security bug (spoofable client IP, or every user sharing one rate-limit
  // bucket), so validate rather than silently coercing NaN to 0.
  const hops = config.TRUSTED_PROXY_HOPS;
  if (hops !== undefined && hops !== '') {
    const parsed = Number(hops);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
      errors.push('TRUSTED_PROXY_HOPS must be an integer between 0 and 10.');
    }
  }

  // How long the audit trail keeps IP addresses and user agents. Too short and
  // an incident is already unreconstructible; unbounded and it becomes personal
  // data kept without a limit.
  const retention = config.AUDIT_LOG_RETENTION_DAYS;
  if (retention !== undefined && retention !== '') {
    const parsed = Number(retention);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
      errors.push(
        'AUDIT_LOG_RETENTION_DAYS must be an integer between 1 and 3650.',
      );
    }
  }

  // Backing store for the rate-limit counters. Without it the throttler counts
  // in process memory: limits reset on every deploy and multiply by the number
  // of instances, which is the difference between a real brute-force control
  // and a decorative one.
  const redisUrl = config.REDIS_URL;
  if (isProd && !redisUrl) {
    errors.push('REDIS_URL is required in production.');
  }
  if (typeof redisUrl === 'string' && redisUrl !== '') {
    let parsed: URL | null = null;
    try {
      parsed = new URL(redisUrl);
    } catch {
      parsed = null;
    }
    if (parsed === null) {
      errors.push('REDIS_URL must be a valid URL.');
    } else if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
      errors.push('REDIS_URL must use the redis:// or rediss:// scheme.');
    } else if (isProd && !parsed.password) {
      // An unauthenticated Redis reachable from the app is a standing invitation
      // to read and reset every counter.
      errors.push('REDIS_URL must include a password in production.');
    }
  }

  if (isProd) {
    const rawOrigins =
      typeof config.CORS_ORIGIN === 'string' ? config.CORS_ORIGIN : '';
    const origins = rawOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (origins.length === 0) {
      errors.push('CORS_ORIGIN is required in production.');
    }
    if (origins.includes('*')) {
      errors.push(
        'CORS_ORIGIN cannot be "*" — credentialed CORS requires explicit origins.',
      );
    }
    if (origins.some((o) => o.startsWith('http://'))) {
      errors.push('CORS_ORIGIN must use https:// in production.');
    }

    // The base of every link mailed out. Wrong, and password-reset links point
    // somewhere the user cannot reach — or somewhere an attacker controls.
    const appUrl = typeof config.APP_URL === 'string' ? config.APP_URL : '';
    if (!appUrl) {
      errors.push('APP_URL is required in production.');
    } else if (!appUrl.startsWith('https://')) {
      errors.push('APP_URL must use https:// in production.');
    }

    // Without a relay, account recovery and address verification fail silently
    // — the one class of outage a user cannot work around.
    if (!config.SMTP_HOST) {
      errors.push('SMTP_HOST is required in production.');
    }
    if (!config.MAIL_FROM) {
      errors.push('MAIL_FROM is required in production.');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}`,
    );
  }

  return config;
}
