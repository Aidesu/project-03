import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenError, TokenService } from './token.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

describe('TokenService', () => {
  let prisma: {
    refreshSession: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: TokenService;

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ACCESS_TOKEN_TTL = '15m';
    process.env.REFRESH_TOKEN_TTL_DAYS = '7';
  });

  beforeEach(() => {
    prisma = {
      refreshSession: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new TokenService(
      new JwtService({}),
      prisma as unknown as PrismaService,
    );
  });

  it('issues and verifies an access token', async () => {
    const token = await service.issueAccessToken({
      sub: 1,
      email: 'a@b.c',
      role: Role.USER,
    });
    const payload = await service.verifyAccessToken(token);
    expect(payload.sub).toBe(1);
    expect(payload.email).toBe('a@b.c');
    expect(payload.role).toBe(Role.USER);
  });

  it('rejects an access token signed with the wrong secret', async () => {
    const token = await service.issueAccessToken({
      sub: 1,
      email: 'a@b.c',
      role: Role.USER,
    });
    process.env.JWT_ACCESS_SECRET = 'different-secret';
    const tampered = new TokenService(
      new JwtService({}),
      prisma as unknown as PrismaService,
    );
    await expect(tampered.verifyAccessToken(token)).rejects.toBeDefined();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  });

  it('stores only the sha256 hash of a new refresh token', async () => {
    const raw = await service.issueRefreshSession(42, { ip: '1.2.3.4' });
    expect(prisma.refreshSession.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.refreshSession.create.mock.calls[0][0];
    expect(data.userId).toBe(42);
    expect(data.tokenHash).toBe(sha256(raw));
    expect(data.tokenHash).not.toContain(raw);
  });

  it('rotates a valid refresh token: revokes the old, mints a new one in the same family', async () => {
    prisma.refreshSession.findFirst.mockResolvedValue({
      id: 's1',
      userId: 7,
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.rotateRefreshSession('raw-token');

    expect(result.userId).toBe(7);
    expect(result.token).toBeTruthy();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.refreshSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } }),
    );
    const created = prisma.refreshSession.create.mock.calls.at(-1)[0].data;
    expect(created.familyId).toBe('fam-1');
    expect(created.tokenHash).toBe(sha256(result.token));
  });

  it('detects reuse of a revoked token and burns the whole family', async () => {
    prisma.refreshSession.findFirst.mockResolvedValue({
      id: 's1',
      userId: 7,
      familyId: 'fam-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.rotateRefreshSession('raw')).rejects.toBeInstanceOf(
      RefreshTokenError,
    );
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: 'fam-1', revokedAt: null },
      }),
    );
  });

  it('rejects an unknown refresh token', async () => {
    prisma.refreshSession.findFirst.mockResolvedValue(null);
    await expect(service.rotateRefreshSession('x')).rejects.toBeInstanceOf(
      RefreshTokenError,
    );
  });

  it('rejects an expired refresh token', async () => {
    prisma.refreshSession.findFirst.mockResolvedValue({
      id: 's1',
      userId: 7,
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    });
    await expect(service.rotateRefreshSession('x')).rejects.toBeInstanceOf(
      RefreshTokenError,
    );
  });
});
