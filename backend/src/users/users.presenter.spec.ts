import { Role, User, UserSettings } from '@prisma/client';
import { toSafeSettings, toSafeUser } from './users.service';

const user: User = {
  id: 42,
  publicId: '11111111-2222-4333-8444-555555555555',
  email: 'a@b.c',
  emailVerifiedAt: new Date('2026-01-01T12:00:00Z'),
  name: 'Ada',
  passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$abc$def',
  avatarStorageKey: 'avatars/42/secret.webp',
  role: Role.USER,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

const settings: UserSettings = {
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  userId: 42,
  locale: 'fr',
  timezone: 'Europe/Paris',
  weeklyApplicationGoal: 5,
  emailRemindersEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

describe('toSafeUser', () => {
  // The whole point of publicId: swapping it back for the primary key would
  // hand clients a sequential number they can count and, once any route takes
  // a user identifier, enumerate.
  it('exposes the opaque publicId as `id`, never the primary key', () => {
    const safe = toSafeUser(user);
    expect(safe.id).toBe(user.publicId);
    expect(safe.id).not.toBe(user.id);
    expect(JSON.stringify(safe)).not.toContain('42');
  });

  it('never leaks the password hash or the avatar storage key', () => {
    const serialized = JSON.stringify(toSafeUser(user, 'https://signed.url'));
    expect(serialized).not.toContain('argon2id');
    expect(serialized).not.toContain('avatars/');
  });

  // Allowlist, not exclusion: a column added to User must not appear here
  // until someone deliberately adds it.
  it('emits exactly the agreed field set', () => {
    expect(Object.keys(toSafeUser(user)).sort()).toEqual([
      'avatarUrl',
      'createdAt',
      'email',
      'emailVerified',
      'id',
      'locale',
      'name',
      'role',
      'timezone',
      'updatedAt',
    ]);
  });

  // The client branches on a boolean; the timestamp is an internal detail and
  // has no business being exposed.
  it('reduces the verification timestamp to a boolean', () => {
    expect(toSafeUser(user).emailVerified).toBe(true);
    expect(toSafeUser({ ...user, emailVerifiedAt: null }).emailVerified).toBe(
      false,
    );
    expect(JSON.stringify(toSafeUser(user))).not.toContain('emailVerifiedAt');
  });

  it('carries the display preferences so the UI can pick a language at once', () => {
    const safe = toSafeUser(user, null, {
      locale: 'de',
      timezone: 'Europe/Berlin',
    });
    expect(safe.locale).toBe('de');
    expect(safe.timezone).toBe('Europe/Berlin');
  });

  // A user who never opened the settings page has no UserSettings row; the
  // presenter must still answer with a usable locale instead of undefined.
  it('falls back to the schema defaults when no settings row exists', () => {
    const safe = toSafeUser(user);
    expect(safe.locale).toBe('fr');
    expect(safe.timezone).toBe('Europe/Paris');
  });
});

describe('toSafeSettings', () => {
  it('drops the internal userId foreign key and the row id', () => {
    const safe = toSafeSettings(settings);
    expect(safe).not.toHaveProperty('userId');
    expect(safe).not.toHaveProperty('id');
    expect(JSON.stringify(safe)).not.toContain('42');
  });

  it('keeps every setting the client actually needs', () => {
    expect(Object.keys(toSafeSettings(settings)).sort()).toEqual([
      'createdAt',
      'emailRemindersEnabled',
      'locale',
      'timezone',
      'updatedAt',
      'weeklyApplicationGoal',
    ]);
  });
});
