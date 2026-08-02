import { VerificationTokenPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationTokenService } from './verification-token.service';

const USER_ID = 7;

describe('VerificationTokenService', () => {
  let prisma: {
    verificationToken: {
      create: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: VerificationTokenService;

  beforeEach(() => {
    // Read when the instance is built, so setting it here is enough.
    process.env.EMAIL_TOKEN_SECRET = 'test-email-token-secret';
    prisma = {
      verificationToken: {
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new VerificationTokenService(prisma as unknown as PrismaService);
  });

  describe('issue', () => {
    it('stores a hash, never the token it hands out', async () => {
      const raw = await service.issue(
        USER_ID,
        'user@example.com',
        VerificationTokenPurpose.PASSWORD_RESET,
        60_000,
      );

      const { data } = prisma.verificationToken.create.mock.calls[0][0];
      expect(raw.length).toBeGreaterThan(32);
      expect(data.tokenHash).not.toBe(raw);
      expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(data)).not.toContain(raw);
    });

    it('invalidates any outstanding token of the same purpose', async () => {
      // Otherwise asking for a second link leaves the first one live, and an
      // older mail stays a working key to the account.
      await service.issue(
        USER_ID,
        'user@example.com',
        VerificationTokenPurpose.PASSWORD_RESET,
        60_000,
      );

      expect(prisma.verificationToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: USER_ID,
          purpose: VerificationTokenPurpose.PASSWORD_RESET,
          consumedAt: null,
        },
        data: { consumedAt: expect.any(Date) },
      });
    });

    it('mints a different token every time', async () => {
      const args = [
        USER_ID,
        'user@example.com',
        VerificationTokenPurpose.EMAIL_VERIFICATION,
        60_000,
      ] as const;
      expect(await service.issue(...args)).not.toBe(
        await service.issue(...args),
      );
    });
  });

  describe('consume', () => {
    it('lets the database decide single use, not a prior read', async () => {
      prisma.verificationToken.findUnique.mockResolvedValue({
        userId: USER_ID,
        email: 'user@example.com',
      });

      await service.consume(
        'raw-token',
        VerificationTokenPurpose.PASSWORD_RESET,
      );

      // The guards that matter are in the WHERE clause: of two requests racing
      // on one link, exactly one gets a row count of 1.
      const { where } = prisma.verificationToken.updateMany.mock.calls[0][0];
      expect(where.consumedAt).toBeNull();
      expect(where.expiresAt).toEqual({ gt: expect.any(Date) });
      expect(where.purpose).toBe(VerificationTokenPurpose.PASSWORD_RESET);
    });

    it('returns null when nothing was claimed (spent, expired or unknown)', async () => {
      prisma.verificationToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.consume('raw-token', VerificationTokenPurpose.PASSWORD_RESET),
      ).resolves.toBeNull();
      expect(prisma.verificationToken.findUnique).not.toHaveBeenCalled();
    });

    it('will not redeem a token issued for another purpose', async () => {
      prisma.verificationToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.consume(
          'raw-token',
          VerificationTokenPurpose.EMAIL_VERIFICATION,
        ),
      ).resolves.toBeNull();
    });
  });
});
