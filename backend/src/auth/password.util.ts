// @node-rs/argon2 defaults to Argon2id. OWASP-recommended cost (~19 MiB, 2 iterations).
// Single source of truth: anywhere a password is hashed or verified must use
// these exact options, or existing hashes silently fail to verify.
export const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};
