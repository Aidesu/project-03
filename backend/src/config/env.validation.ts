/**
 * Boot-time environment validation, wired into `ConfigModule.forRoot({ validate })`.
 *
 * Fails fast so the app never starts in a misconfigured (especially insecure)
 * state: missing secrets, or production still using the `change-me` placeholders.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const isProd = config.NODE_ENV === 'production';

  const required = ['DATABASE_URL'];
  const secrets = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CSRF_SECRET'];

  const missing: string[] = [];

  for (const key of required) {
    if (!config[key]) missing.push(key);
  }

  for (const key of secrets) {
    const value = config[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    if (isProd && typeof value === 'string' && value.startsWith('change-me')) {
      throw new Error(
        `Refusing to start in production: ${key} is still the placeholder value. Set a strong secret.`,
      );
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  return config;
}
