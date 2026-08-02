import { ForbiddenException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DataExportService } from './data-export.service';

const USER_ID = 5;
const OTHER_USER_ID = 6;
const ctx: RequestContext = {
  ip: '203.0.113.7',
  userAgent: 'jest',
  correlationId: '00000000-0000-4000-8000-0000000000ff',
};

/**
 * Every table the export reads, and how it is scoped: directly by `userId`, or
 * through the owning application for the two tables that have no user column.
 */
const SCOPED_READS: Array<{
  delegate: string;
  method: 'findMany' | 'findUnique';
  via: 'userId' | 'application';
}> = [
  { delegate: 'userSettings', method: 'findUnique', via: 'userId' },
  { delegate: 'company', method: 'findMany', via: 'userId' },
  { delegate: 'contact', method: 'findMany', via: 'userId' },
  { delegate: 'jobApplication', method: 'findMany', via: 'userId' },
  {
    delegate: 'applicationStatusEvent',
    method: 'findMany',
    via: 'application',
  },
  { delegate: 'interview', method: 'findMany', via: 'application' },
  { delegate: 'document', method: 'findMany', via: 'userId' },
  { delegate: 'reminder', method: 'findMany', via: 'userId' },
  { delegate: 'tag', method: 'findMany', via: 'userId' },
  { delegate: 'applicationTag', method: 'findMany', via: 'application' },
  { delegate: 'emailTemplate', method: 'findMany', via: 'userId' },
  { delegate: 'gamificationProfile', method: 'findUnique', via: 'userId' },
  { delegate: 'xpEvent', method: 'findMany', via: 'userId' },
  { delegate: 'userAchievement', method: 'findMany', via: 'userId' },
  { delegate: 'refreshSession', method: 'findMany', via: 'userId' },
  { delegate: 'auditLog', method: 'findMany', via: 'userId' },
];

describe('DataExportService', () => {
  let prisma: Record<string, any>;
  let storage: { presignGet: jest.Mock };
  let audit: { success: jest.Mock; failure: jest.Mock };
  let service: DataExportService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          publicId: '00000000-0000-4000-8000-000000000005',
          email: 'user@example.com',
          emailVerifiedAt: null,
          name: 'Someone',
          role: 'USER',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          avatarStorageKey: null,
        }),
      },
      // Resolves the batch in order, like a real interactive transaction.
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    for (const { delegate, method } of SCOPED_READS) {
      prisma[delegate] = {
        [method]: jest
          .fn()
          .mockResolvedValue(method === 'findMany' ? [] : null),
      };
    }
    storage = { presignGet: jest.fn().mockResolvedValue('https://s3/avatar') };
    audit = {
      success: jest.fn().mockResolvedValue(undefined),
      failure: jest.fn().mockResolvedValue(undefined),
    };
    service = new DataExportService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      audit as unknown as AuditService,
    );
  });

  // The negative authorization case: an export is the single call that reads
  // the widest slice of the database, so one unscoped query here hands another
  // account's data to the caller in a tidy machine-readable file.
  it('scopes every read to the requesting account', async () => {
    await service.exportForUser(USER_ID, ctx);

    for (const { delegate, method, via } of SCOPED_READS) {
      const call = prisma[delegate][method].mock.calls[0]?.[0] as {
        where?: Record<string, unknown>;
      };
      expect(call?.where).toBeDefined();
      expect(call.where).toEqual(
        via === 'userId'
          ? { userId: USER_ID }
          : { application: { userId: USER_ID } },
      );
      expect(JSON.stringify(call.where)).not.toContain(String(OTHER_USER_ID));
    }
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } }),
    );
  });

  // Not "the export happens to omit them today" — the two tables holding
  // credentials are read through an allowlist that cannot grow by accident.
  it('never reads a password hash or a session token hash', async () => {
    await service.exportForUser(USER_ID, ctx);

    const userSelect = prisma.user.findUnique.mock.calls[0][0].select as Record<
      string,
      boolean
    >;
    expect(userSelect).toBeDefined();
    expect(userSelect.passwordHash).toBeUndefined();

    const sessionSelect = prisma.refreshSession.findMany.mock.calls[0][0]
      .select as Record<string, boolean>;
    expect(sessionSelect).toBeDefined();
    expect(sessionSelect.tokenHash).toBeUndefined();
  });

  // Live recovery links are account takeover in a file — they are not part of
  // "the data we hold about you" in any useful sense.
  it('does not touch the verification-token table at all', () => {
    expect(prisma.verificationToken).toBeUndefined();
  });

  it('produces one consistent snapshot rather than independent reads', async () => {
    await service.exportForUser(USER_ID, ctx);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('records the export in the audit trail', async () => {
    await service.exportForUser(USER_ID, ctx);
    expect(audit.success).toHaveBeenCalledWith(AuditAction.DATA_EXPORTED, {
      userId: USER_ID,
      context: ctx,
    });
  });

  it('fails closed when the account is gone mid-request', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.exportForUser(USER_ID, ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.success).not.toHaveBeenCalled();
  });

  it('carries the avatar as a short-lived link, never the storage key', async () => {
    prisma.user.findUnique.mockResolvedValue({
      publicId: '00000000-0000-4000-8000-000000000005',
      email: 'user@example.com',
      emailVerifiedAt: null,
      name: null,
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
      avatarStorageKey: 'avatars/5/secret-key.webp',
    });

    const result = await service.exportForUser(USER_ID, ctx);

    expect(JSON.stringify(result)).not.toContain('avatars/5/secret-key.webp');
    const profile = result.profile as Record<string, unknown>;
    expect(profile.avatarUrl).toBe('https://s3/avatar');
    expect(profile.avatarUrlExpiresInSeconds).toBe(900);
  });
});
