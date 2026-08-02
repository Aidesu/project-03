import { ForbiddenException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { AuditAction, Role, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccountRecoveryService } from '../auth/account-recovery.service';
import { TokenService } from '../auth/token.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from './users.service';

const USER_ID = 5;
const PASSWORD = 'current-password-123';
const ctx: RequestContext = {
  ip: '203.0.113.7',
  userAgent: 'jest',
  correlationId: '00000000-0000-4000-8000-0000000000ff',
};

/**
 * The three changes an account takeover actually needs: the password, the
 * recovery address, and erasure. Each one has to leave a trail whether it
 * succeeds or fails on the re-authentication gate.
 */
describe('UsersService audit trail', () => {
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    userSettings: { findUnique: jest.Mock };
  };
  let storage: { presignGet: jest.Mock; delete: jest.Mock };
  let tokens: {
    issueAccessToken: jest.Mock;
    issueRefreshSession: jest.Mock;
    revokeAllSessionsForUser: jest.Mock;
  };
  let recovery: { sendEmailVerification: jest.Mock };
  let audit: { success: jest.Mock; failure: jest.Mock };
  let service: UsersService;
  let user: User;

  beforeEach(async () => {
    user = {
      id: USER_ID,
      publicId: '00000000-0000-4000-8000-000000000005',
      email: 'user@example.com',
      emailVerifiedAt: null,
      name: null,
      passwordHash: await hash(PASSWORD),
      avatarStorageKey: null,
      role: Role.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockImplementation(() => Promise.resolve(user)),
        delete: jest.fn().mockResolvedValue(user),
      },
      userSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    storage = { presignGet: jest.fn(), delete: jest.fn() };
    tokens = {
      issueAccessToken: jest.fn().mockResolvedValue('access.jwt'),
      issueRefreshSession: jest.fn().mockResolvedValue('refresh-raw'),
      revokeAllSessionsForUser: jest.fn().mockResolvedValue(undefined),
    };
    recovery = {
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    };
    audit = {
      success: jest.fn().mockResolvedValue(undefined),
      failure: jest.fn().mockResolvedValue(undefined),
    };
    service = new UsersService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      tokens as unknown as TokenService,
      recovery as unknown as AccountRecoveryService,
      audit as unknown as AuditService,
    );
  });

  it('records a password change', async () => {
    await service.changePassword(
      USER_ID,
      { currentPassword: PASSWORD, newPassword: 'brand-new-password' },
      ctx,
    );

    expect(audit.success).toHaveBeenCalledWith(AuditAction.PASSWORD_CHANGED, {
      userId: USER_ID,
      context: ctx,
    });
  });

  // A wrong current password on this route is someone poking at a session they
  // already have — exactly what the trail exists to make visible.
  it('records a failed re-authentication under the action it was gating', async () => {
    await expect(
      service.changePassword(
        USER_ID,
        { currentPassword: 'wrong', newPassword: 'brand-new-password' },
        ctx,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(audit.failure).toHaveBeenCalledWith(AuditAction.PASSWORD_CHANGED, {
      userId: USER_ID,
      context: ctx,
      metadata: { reason: 'invalid_password' },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('records an address change without copying either address into the entry', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ ...user, email: 'new@example.com' });

    await service.updateAccount(
      USER_ID,
      { email: 'new@example.com', currentPassword: PASSWORD },
      ctx,
    );

    const call = audit.success.mock.calls.find(
      ([action]) => action === AuditAction.EMAIL_CHANGED,
    ) as [AuditAction, Record<string, unknown>];
    expect(call).toBeDefined();
    expect(JSON.stringify(call[1])).not.toContain('example.com');
  });

  // The whole reason AuditLog carries no foreign key to User: the row is
  // written after the account is gone and has to stay valid.
  it('records the deletion after the account row is gone', async () => {
    const order: string[] = [];
    prisma.user.delete.mockImplementation(() => {
      order.push('delete');
      return Promise.resolve(user);
    });
    audit.success.mockImplementation(() => {
      order.push('audit');
      return Promise.resolve(undefined);
    });

    await service.deleteAccount(
      USER_ID,
      { currentPassword: PASSWORD, confirmation: 'DELETE' },
      ctx,
    );

    expect(order).toEqual(['delete', 'audit']);
    expect(audit.success).toHaveBeenCalledWith(AuditAction.ACCOUNT_DELETED, {
      userId: USER_ID,
      context: ctx,
    });
  });
});
