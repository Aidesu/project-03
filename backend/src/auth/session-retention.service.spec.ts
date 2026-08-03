import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_SESSION_RETENTION_DAYS,
  SessionRetentionService,
} from './session-retention.service';

describe('SessionRetentionService', () => {
  let prisma: { refreshSession: { deleteMany: jest.Mock } };
  let service: SessionRetentionService;

  beforeEach(() => {
    delete process.env.SESSION_RETENTION_DAYS;
    prisma = {
      refreshSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    service = new SessionRetentionService(prisma as unknown as PrismaService);
  });

  it('deletes revoked rows and rows that expired without being revoked', async () => {
    await service.purgeOlderThan(30);

    const { where } = prisma.refreshSession.deleteMany.mock.calls[0][0];
    expect(where.OR).toHaveLength(2);
    expect(where.OR[0].revokedAt.lt).toBeInstanceOf(Date);
    expect(where.OR[1]).toMatchObject({ revokedAt: null });
    expect(where.OR[1].expiresAt.lt).toBeInstanceOf(Date);
  });

  it('measures the window from now, in days', async () => {
    const before = Date.now();
    await service.purgeOlderThan(30);

    const { where } = prisma.refreshSession.deleteMany.mock.calls[0][0];
    const cutoff = (where.OR[0].revokedAt.lt as Date).getTime();
    const expected = before - 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff - expected)).toBeLessThan(5_000);
  });

  it('never deletes a session that is still usable', async () => {
    await service.purgeOlderThan(30);

    const { where } = prisma.refreshSession.deleteMany.mock.calls[0][0];
    const cutoff = where.OR[0].revokedAt.lt as Date;
    // A live row has revokedAt null and expiresAt in the future, so it matches
    // neither branch: the first requires a revocation date, the second an
    // expiry already past the cutoff.
    expect(cutoff.getTime()).toBeLessThan(Date.now());
    expect(where.OR[1].revokedAt).toBeNull();
  });

  it('returns the number of rows deleted', async () => {
    prisma.refreshSession.deleteMany.mockResolvedValue({ count: 12 });
    await expect(service.purgeOlderThan(30)).resolves.toBe(12);
  });

  it('defaults to the documented retention window', async () => {
    await service.purgeDeadSessions();

    const { where } = prisma.refreshSession.deleteMany.mock.calls[0][0];
    const cutoff = (where.OR[0].revokedAt.lt as Date).getTime();
    const expected =
      Date.now() - DEFAULT_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff - expected)).toBeLessThan(5_000);
  });

  it('swallows a failed purge — retention is not an availability concern', async () => {
    prisma.refreshSession.deleteMany.mockRejectedValue(new Error('db down'));

    await expect(service.purgeDeadSessions()).resolves.toBeUndefined();
  });
});
