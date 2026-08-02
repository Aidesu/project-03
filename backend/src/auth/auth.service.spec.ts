import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { AuditAction, Role, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { UsersService } from '../users/users.service';
import { AccountRecoveryService } from './account-recovery.service';
import { AuthService } from './auth.service';
import { RefreshTokenError, TokenService } from './token.service';

const ctx: RequestContext = {
  userAgent: 'jest',
  ip: '127.0.0.1',
  correlationId: '00000000-0000-4000-8000-0000000000ff',
};

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    publicId: '00000000-0000-4000-8000-000000000001',
    email: 'user@example.com',
    emailVerifiedAt: null,
    name: null,
    passwordHash: 'placeholder',
    avatarStorageKey: null,
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let users: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    presentUser: jest.Mock;
  };
  let tokens: {
    issueAccessToken: jest.Mock;
    issueRefreshSession: jest.Mock;
    rotateRefreshSession: jest.Mock;
    revokeRefreshToken: jest.Mock;
  };
  let recovery: { sendEmailVerification: jest.Mock };
  let audit: { success: jest.Mock; failure: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      presentUser: jest.fn().mockImplementation((user: User) => {
        const safe: Record<string, unknown> = { ...user };
        delete safe.passwordHash;
        delete safe.avatarStorageKey;
        return Promise.resolve({ ...safe, avatarUrl: null });
      }),
    };
    tokens = {
      issueAccessToken: jest.fn().mockResolvedValue('access.jwt'),
      issueRefreshSession: jest.fn().mockResolvedValue('refresh-raw'),
      rotateRefreshSession: jest.fn(),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
    };
    recovery = {
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    };
    audit = {
      success: jest.fn().mockResolvedValue(undefined),
      failure: jest.fn().mockResolvedValue(undefined),
    };
    service = new AuthService(
      users as unknown as UsersService,
      tokens as unknown as TokenService,
      recovery as unknown as AccountRecoveryService,
      audit as unknown as AuditService,
    );
  });

  describe('register', () => {
    it('rejects a duplicate email', async () => {
      users.findByEmail.mockResolvedValue(buildUser());
      await expect(
        service.register(
          { email: 'user@example.com', password: 'a'.repeat(12) },
          ctx,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('hashes the password with argon2id and issues tokens', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockImplementation(
        ({ email, passwordHash }: { email: string; passwordHash: string }) =>
          Promise.resolve(buildUser({ email, passwordHash })),
      );

      const result = await service.register(
        { email: 'new@example.com', password: 'super-secret-pw' },
        ctx,
      );

      const created = users.create.mock.calls[0][0];
      expect(created.passwordHash).toMatch(/^\$argon2id\$/);
      expect(created.passwordHash).not.toContain('super-secret-pw');
      expect(result.accessToken).toBe('access.jwt');
      expect(result.refreshToken).toBe('refresh-raw');
      expect(tokens.issueRefreshSession).toHaveBeenCalledWith(1, ctx);
    });
  });

  describe('login', () => {
    it('accepts valid credentials', async () => {
      const passwordHash = await hash('correct-horse-battery');
      users.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      const result = await service.login(
        { email: 'user@example.com', password: 'correct-horse-battery' },
        ctx,
      );
      expect(result.user.id).toBe(1);
      expect(result.accessToken).toBe('access.jwt');
    });

    it('rejects a wrong password with a generic error', async () => {
      const passwordHash = await hash('correct-horse-battery');
      users.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown user with the same generic error (no enumeration)', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(
        service.login(
          { email: 'ghost@example.com', password: 'whatever-1234' },
          ctx,
        ),
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('refresh', () => {
    it('rotates and issues a fresh access token', async () => {
      tokens.rotateRefreshSession.mockResolvedValue({
        token: 'next-refresh',
        userId: 1,
      });
      users.findById.mockResolvedValue(buildUser());

      const result = await service.refresh('old-refresh', ctx);
      expect(result.refreshToken).toBe('next-refresh');
      expect(result.accessToken).toBe('access.jwt');
      expect(result.user.id).toBe(1);
    });

    it('maps refresh-token errors to Unauthorized', async () => {
      tokens.rotateRefreshSession.mockRejectedValue(
        new RefreshTokenError('reuse'),
      );
      await expect(service.refresh('bad', ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the session when a token is present', async () => {
      await service.logout('some-refresh', 1, ctx);
      expect(tokens.revokeRefreshToken).toHaveBeenCalledWith('some-refresh');
    });

    it('is a no-op without a token', async () => {
      await service.logout(undefined, 1, ctx);
      expect(tokens.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  // The trail is what an incident is reconstructed from, so these assert the
  // three things that make an entry usable: the right action, the actor when
  // one is known, and no address ever copied into the entry.
  describe('audit trail', () => {
    it('records a successful login against the account, with the request context', async () => {
      const passwordHash = await hash('correct-horse-battery');
      users.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      await service.login(
        { email: 'user@example.com', password: 'correct-horse-battery' },
        ctx,
      );

      expect(audit.success).toHaveBeenCalledWith(AuditAction.USER_LOGIN, {
        userId: 1,
        context: ctx,
      });
      expect(audit.failure).not.toHaveBeenCalled();
    });

    it('records a wrong password against the account it was tried on', async () => {
      const passwordHash = await hash('correct-horse-battery');
      users.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(audit.failure).toHaveBeenCalledWith(AuditAction.USER_LOGIN, {
        userId: 1,
        context: ctx,
        metadata: { reason: 'invalid_password' },
      });
    });

    it('records a login on an unknown address without storing the address', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.login(
          { email: 'ghost@example.com', password: 'whatever-1234' },
          ctx,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      const [action, options] = audit.failure.mock.calls[0] as [
        AuditAction,
        Record<string, unknown>,
      ];
      expect(action).toBe(AuditAction.USER_LOGIN);
      expect(options.userId).toBeUndefined();
      expect(JSON.stringify(options)).not.toContain('ghost@example.com');
    });

    it('records a registration attempt on a taken address', async () => {
      users.findByEmail.mockResolvedValue(buildUser());

      await expect(
        service.register(
          { email: 'user@example.com', password: 'a'.repeat(12) },
          ctx,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(audit.failure).toHaveBeenCalledWith(AuditAction.USER_REGISTERED, {
        context: ctx,
        metadata: { reason: 'email_taken' },
      });
    });

    it('records the logout', async () => {
      await service.logout('some-refresh', 1, ctx);
      expect(audit.success).toHaveBeenCalledWith(AuditAction.USER_LOGOUT, {
        userId: 1,
        context: ctx,
      });
    });

    // Every 15 minutes per active device: it would drown the entries that
    // matter, and RefreshSession already holds the same facts.
    it('does not record successful token rotations', async () => {
      tokens.rotateRefreshSession.mockResolvedValue({
        token: 'next-refresh',
        userId: 1,
      });
      users.findById.mockResolvedValue(buildUser());

      await service.refresh('old-refresh', ctx);
      expect(audit.success).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('returns a user without the password hash', async () => {
      users.findById.mockResolvedValue(
        buildUser({ passwordHash: 'secret-hash' }),
      );
      const safe = await service.getProfile(1);
      expect(safe).not.toHaveProperty('passwordHash');
      expect(safe.email).toBe('user@example.com');
    });

    it('throws when the user no longer exists', async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.getProfile(99)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
