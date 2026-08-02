import { BadRequestException } from '@nestjs/common';
import { VerificationTokenPurpose } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountRecoveryService } from './account-recovery.service';
import { TokenService } from './token.service';
import { VerificationTokenService } from './verification-token.service';

const USER_ID = 7;
const EMAIL = 'user@example.com';
const RAW_TOKEN = 'raw-token-value';

const buildUser = (overrides: Record<string, unknown> = {}) => ({
  id: USER_ID,
  email: EMAIL,
  emailVerifiedAt: null,
  ...overrides,
});

describe('AccountRecoveryService', () => {
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    userSettings: { findUnique: jest.Mock };
  };
  let tokens: { issue: jest.Mock; consume: jest.Mock };
  let sessions: { revokeAllSessionsForUser: jest.Mock };
  let mail: { send: jest.Mock };
  let service: AccountRecoveryService;

  beforeEach(() => {
    process.env.APP_URL = 'https://app.example.com';
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ locale: 'fr' }),
      },
    };
    tokens = {
      issue: jest.fn().mockResolvedValue(RAW_TOKEN),
      consume: jest.fn(),
    };
    sessions = { revokeAllSessionsForUser: jest.fn() };
    mail = { send: jest.fn().mockResolvedValue(undefined) };
    service = new AccountRecoveryService(
      prisma as unknown as PrismaService,
      tokens as unknown as VerificationTokenService,
      sessions as unknown as TokenService,
      mail as unknown as MailService,
    );
  });

  describe('requestPasswordReset', () => {
    // The response is identical either way (204); this is the other half of
    // that promise — an unknown address must not even cost a token row.
    it('does nothing at all for an unknown address', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.requestPasswordReset('ghost@example.com'),
      ).resolves.toBeUndefined();

      expect(tokens.issue).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('mails a reset link scoped to the account address', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      await service.requestPasswordReset(EMAIL);

      expect(tokens.issue).toHaveBeenCalledWith(
        USER_ID,
        EMAIL,
        VerificationTokenPurpose.PASSWORD_RESET,
        expect.any(Number),
      );
      const sent = mail.send.mock.calls[0][0];
      expect(sent.to).toBe(EMAIL);
      expect(sent.text).toContain(
        `https://app.example.com/reset-password?token=${RAW_TOKEN}`,
      );
    });

    it('writes the language the user reads, not the server default', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.userSettings.findUnique.mockResolvedValue({ locale: 'de' });

      await service.requestPasswordReset(EMAIL);

      expect(mail.send.mock.calls[0][0].subject).toBe('Passwort zurücksetzen');
    });
  });

  describe('resetPassword', () => {
    it('refuses a token that could not be redeemed', async () => {
      tokens.consume.mockResolvedValue(null);

      await expect(
        service.resetPassword(RAW_TOKEN, 'a'.repeat(12)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    // The link was mailed to an inbox the account has since left — very likely
    // the compromised one the address change was meant to escape.
    it('refuses a token issued for an address the account no longer uses', async () => {
      tokens.consume.mockResolvedValue({
        userId: USER_ID,
        email: 'old@example.com',
      });
      prisma.user.findUnique.mockResolvedValue(buildUser());

      await expect(
        service.resetPassword(RAW_TOKEN, 'a'.repeat(12)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('stores an argon2id hash and kills every existing session', async () => {
      tokens.consume.mockResolvedValue({ userId: USER_ID, email: EMAIL });
      prisma.user.findUnique.mockResolvedValue(buildUser());

      await service.resetPassword(RAW_TOKEN, 'brand-new-password');

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(data.passwordHash).toMatch(/^\$argon2id\$/);
      expect(data.passwordHash).not.toContain('brand-new-password');
      // Whoever forced the reset may be holding a session of their own.
      expect(sessions.revokeAllSessionsForUser).toHaveBeenCalledWith(USER_ID);
    });

    it('treats redeeming the link as proof the inbox is reachable', async () => {
      tokens.consume.mockResolvedValue({ userId: USER_ID, email: EMAIL });
      prisma.user.findUnique.mockResolvedValue(buildUser());

      await service.resetPassword(RAW_TOKEN, 'brand-new-password');

      expect(
        prisma.user.update.mock.calls[0][0].data.emailVerifiedAt,
      ).toBeInstanceOf(Date);
    });

    it('keeps the original verification date when there already is one', async () => {
      const verifiedAt = new Date('2026-01-01T00:00:00Z');
      tokens.consume.mockResolvedValue({ userId: USER_ID, email: EMAIL });
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ emailVerifiedAt: verifiedAt }),
      );

      await service.resetPassword(RAW_TOKEN, 'brand-new-password');

      expect(prisma.user.update.mock.calls[0][0].data.emailVerifiedAt).toBe(
        verifiedAt,
      );
    });
  });

  describe('verifyEmail', () => {
    it('marks the address verified', async () => {
      tokens.consume.mockResolvedValue({ userId: USER_ID, email: EMAIL });
      prisma.user.findUnique.mockResolvedValue(buildUser());

      await service.verifyEmail(RAW_TOKEN);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { emailVerifiedAt: expect.any(Date) },
      });
    });

    it('refuses an unredeemable token with the same generic message', async () => {
      tokens.consume.mockResolvedValue(null);

      await expect(service.verifyEmail(RAW_TOKEN)).rejects.toThrow(
        /invalid or has expired/i,
      );
    });

    it('refuses a token issued for a different address', async () => {
      tokens.consume.mockResolvedValue({
        userId: USER_ID,
        email: 'old@example.com',
      });
      prisma.user.findUnique.mockResolvedValue(buildUser());

      await expect(service.verifyEmail(RAW_TOKEN)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('sendEmailVerification', () => {
    it('does nothing for an already-verified address', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ emailVerifiedAt: new Date() }),
      );

      await service.sendEmailVerification({ id: USER_ID, email: EMAIL });

      expect(tokens.issue).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('uses the signup language when the account has no settings yet', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.userSettings.findUnique.mockResolvedValue(null);

      await service.sendEmailVerification({ id: USER_ID, email: EMAIL }, 'es');

      expect(mail.send.mock.calls[0][0].subject).toBe(
        'Confirma tu dirección de correo',
      );
      expect(prisma.userSettings.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to the product default when nothing says otherwise', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.userSettings.findUnique.mockResolvedValue(null);

      await service.sendEmailVerification({ id: USER_ID, email: EMAIL });

      expect(mail.send.mock.calls[0][0].subject).toBe(
        'Confirmez votre adresse e-mail',
      );
    });
  });
});
