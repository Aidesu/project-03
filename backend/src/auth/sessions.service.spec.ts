import { createHmac } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CurrentSessionRevocationError,
  SessionsService,
} from './sessions.service';
import { TokenService } from './token.service';

const REFRESH_SECRET = 'test-refresh-secret';
const hashed = (s: string) =>
  createHmac('sha256', REFRESH_SECRET).update(s).digest('hex');

const SIGNED_IN = new Date('2026-08-01T09:00:00.000Z');
const LAST_SEEN = new Date('2026-08-03T08:00:00.000Z');
const EXPIRES = new Date('2026-08-10T08:00:00.000Z');

/** A live row as `listActive` selects it. */
const row = (overrides: Partial<Record<string, unknown>> = {}) => ({
  familyId: 'fam-1',
  tokenHash: hashed('token-1'),
  familyCreatedAt: SIGNED_IN,
  createdAt: LAST_SEEN,
  expiresAt: EXPIRES,
  userAgent: 'Firefox',
  ip: '203.0.113.7',
  ...overrides,
});

describe('SessionsService', () => {
  let prisma: {
    refreshSession: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let audit: { success: jest.Mock; failure: jest.Mock };
  let service: SessionsService;

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
  });

  beforeEach(() => {
    prisma = {
      refreshSession: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    audit = {
      success: jest.fn().mockResolvedValue(undefined),
      failure: jest.fn().mockResolvedValue(undefined),
    };
    const tokens = new TokenService(
      new JwtService({}),
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
    service = new SessionsService(
      prisma as unknown as PrismaService,
      tokens,
      audit as unknown as AuditService,
    );
  });

  describe('listActive', () => {
    it('only reads live sessions belonging to the user', async () => {
      await service.listActive(7);

      const where = prisma.refreshSession.findMany.mock.calls[0][0].where;
      expect(where.userId).toBe(7);
      expect(where.revokedAt).toBeNull();
      expect(where.expiresAt.gt).toBeInstanceOf(Date);
    });

    it('reports when the device signed in, not when it last rotated', async () => {
      prisma.refreshSession.findMany.mockResolvedValue([row()]);

      const [session] = await service.listActive(7);

      expect(session.signedInAt).toEqual(SIGNED_IN);
      expect(session.lastSeenAt).toEqual(LAST_SEEN);
    });

    it('collapses a rotation family into a single device, keeping the newest row', async () => {
      prisma.refreshSession.findMany.mockResolvedValue([
        row({ ip: '203.0.113.9', createdAt: LAST_SEEN }),
        row({ ip: '203.0.113.7', createdAt: new Date('2026-08-02T08:00:00Z') }),
      ]);

      const sessions = await service.listActive(7);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].ip).toBe('203.0.113.9');
    });

    it('flags the caller own session and only that one', async () => {
      prisma.refreshSession.findMany.mockResolvedValue([
        row({ familyId: 'fam-1', tokenHash: hashed('token-1') }),
        row({ familyId: 'fam-2', tokenHash: hashed('token-2') }),
      ]);

      const sessions = await service.listActive(7, 'token-2');

      expect(sessions.map((s) => [s.id, s.current])).toEqual([
        ['fam-1', false],
        ['fam-2', true],
      ]);
    });

    it('flags nothing when the caller presents no refresh token', async () => {
      prisma.refreshSession.findMany.mockResolvedValue([row()]);

      const [session] = await service.listActive(7);

      expect(session.current).toBe(false);
    });

    it('never exposes the token hash', async () => {
      prisma.refreshSession.findMany.mockResolvedValue([row()]);

      const [session] = await service.listActive(7);

      expect(JSON.stringify(session)).not.toContain(hashed('token-1'));
      expect(session).not.toHaveProperty('tokenHash');
    });
  });

  describe('revokeFamily', () => {
    it('scopes the update by userId, so an id in the URL is not enough', async () => {
      await service.revokeFamily(7, 'fam-1', undefined);

      const where = prisma.refreshSession.updateMany.mock.calls[0][0].where;
      expect(where).toMatchObject({
        userId: 7,
        familyId: 'fam-1',
        revokedAt: null,
      });
    });

    // The negative authorization case: user B aims at user A's session.
    it("reports another user's session as not found, and changes nothing", async () => {
      prisma.refreshSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.revokeFamily(999, 'fam-owned-by-7', undefined),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(audit.success).not.toHaveBeenCalled();
    });

    it('refuses to revoke the session making the request', async () => {
      prisma.refreshSession.findFirst.mockResolvedValue({ id: 'row-1' });

      await expect(
        service.revokeFamily(7, 'fam-1', 'token-1'),
      ).rejects.toBeInstanceOf(CurrentSessionRevocationError);

      expect(prisma.refreshSession.updateMany).not.toHaveBeenCalled();
    });

    it('records the revocation in the audit trail', async () => {
      await service.revokeFamily(7, 'fam-1', undefined, { ip: '203.0.113.7' });

      expect(audit.success).toHaveBeenCalledWith(
        AuditAction.SESSION_REVOKED,
        expect.objectContaining({
          userId: 7,
          metadata: expect.objectContaining({
            familyId: 'fam-1',
            scope: 'single',
          }),
        }),
      );
    });
  });

  describe('revokeAllOthers', () => {
    it('spares the whole family of the calling device', async () => {
      prisma.refreshSession.findFirst.mockResolvedValue({ familyId: 'fam-1' });
      prisma.refreshSession.updateMany.mockResolvedValue({ count: 3 });

      const revoked = await service.revokeAllOthers(7, 'token-1');

      expect(revoked).toBe(3);
      expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 7,
          revokedAt: null,
          familyId: { not: 'fam-1' },
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revokes everything when the caller has no refresh token to spare', async () => {
      await service.revokeAllOthers(7, undefined);

      const where = prisma.refreshSession.updateMany.mock.calls[0][0].where;
      expect(where).toEqual({ userId: 7, revokedAt: null });
    });

    it('stays silent in the trail when there was nothing to revoke', async () => {
      prisma.refreshSession.findFirst.mockResolvedValue({ familyId: 'fam-1' });
      prisma.refreshSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revokeAllOthers(7, 'token-1')).resolves.toBe(0);
      expect(audit.success).not.toHaveBeenCalled();
    });
  });
});
