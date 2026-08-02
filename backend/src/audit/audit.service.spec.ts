import { Logger } from '@nestjs/common';
import { AuditAction, AuditOutcome } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

const CONTEXT = {
  ip: '203.0.113.7',
  userAgent: 'Mozilla/5.0',
  correlationId: '00000000-0000-4000-8000-0000000000ff',
};

describe('AuditService', () => {
  let prisma: { auditLog: { create: jest.Mock; deleteMany: jest.Mock } };
  let service: AuditService;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  const lastEntry = () => prisma.auditLog.create.mock.calls[0][0].data;

  it('writes the actor, the outcome and the request context', async () => {
    await service.success(AuditAction.USER_LOGIN, {
      userId: 42,
      context: CONTEXT,
    });

    expect(lastEntry()).toEqual({
      action: AuditAction.USER_LOGIN,
      outcome: AuditOutcome.SUCCESS,
      userId: 42,
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
      correlationId: CONTEXT.correlationId,
      metadata: undefined,
    });
  });

  it('records an unauthenticated actor as null rather than skipping the entry', async () => {
    await service.failure(AuditAction.USER_LOGIN, {
      context: CONTEXT,
      metadata: { reason: 'unknown_account' },
    });

    const entry = lastEntry();
    expect(entry.userId).toBeNull();
    expect(entry.outcome).toBe(AuditOutcome.FAILURE);
    expect(entry.metadata).toEqual({ reason: 'unknown_account' });
  });

  it('caps the fields an unauthenticated caller controls', async () => {
    await service.failure(AuditAction.USER_LOGIN, {
      context: { ip: 'x'.repeat(200), userAgent: 'y'.repeat(4000) },
    });

    const entry = lastEntry();
    expect(entry.ip).toHaveLength(45);
    expect(entry.userAgent).toHaveLength(255);
  });

  it('normalizes a missing context to nulls', async () => {
    await service.success(AuditAction.USER_LOGOUT, { userId: 1 });

    const entry = lastEntry();
    expect(entry.ip).toBeNull();
    expect(entry.userAgent).toBeNull();
    expect(entry.correlationId).toBeNull();
  });

  // The deliberate trade-off: a broken audit table must not be able to take
  // authentication down with it. The gap has to be loud, not silent.
  it('never propagates a write failure, and logs it as an error', async () => {
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    prisma.auditLog.create.mockRejectedValue(new Error('table is gone'));

    await expect(
      service.success(AuditAction.USER_LOGIN, {
        userId: 42,
        context: CONTEXT,
      }),
    ).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0][0]).toContain(CONTEXT.correlationId);
    logged.mockRestore();
  });

  describe('purgeOlderThan', () => {
    it('deletes strictly older than the retention window', async () => {
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 3 });

      const before = Date.now();
      const deleted = await service.purgeOlderThan(365);
      const after = Date.now();

      expect(deleted).toBe(3);
      const cutoff = (
        prisma.auditLog.deleteMany.mock.calls[0][0] as {
          where: { occurredAt: { lt: Date } };
        }
      ).where.occurredAt.lt;
      const windowMs = 365 * 24 * 60 * 60 * 1000;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - windowMs);
      expect(cutoff.getTime()).toBeLessThanOrEqual(after - windowMs);
    });
  });
});
