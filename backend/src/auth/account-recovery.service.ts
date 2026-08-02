import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { User, VerificationTokenPurpose } from '@prisma/client';
import {
  emailVerificationMail,
  passwordResetMail,
  resolveMailLocale,
} from '../mail/mail-templates';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ARGON2_OPTIONS } from './password.util';
import { TokenService } from './token.service';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_RESET_TTL_MINUTES,
  VerificationTokenService,
} from './verification-token.service';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Password recovery and address verification.
 *
 * Deliberately free of any dependency on UsersService: the account-settings
 * flow has to trigger a verification mail when the address changes, and going
 * through UsersService for that would make the two modules import each other.
 */
@Injectable()
export class AccountRecoveryService {
  private readonly logger = new Logger(AccountRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: VerificationTokenService,
    private readonly sessions: TokenService,
    private readonly mail: MailService,
  ) {}

  /**
   * Start a password reset. Returns without a hint either way — whether the
   * address has an account is not something an unauthenticated caller gets to
   * learn, so the controller answers 204 in every case.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.log('Password reset requested for an unknown address');
      return;
    }

    const token = await this.tokens.issue(
      user.id,
      user.email,
      VerificationTokenPurpose.PASSWORD_RESET,
      PASSWORD_RESET_TTL_MINUTES * MINUTE_MS,
    );

    this.deliver(
      passwordResetMail(
        user.email,
        await this.localeFor(user.id),
        this.link('/reset-password', token),
        PASSWORD_RESET_TTL_MINUTES,
      ),
    );
    this.logger.log(`Password reset requested for user ${user.id}`);
  }

  /**
   * Finish a reset: set the new password and drop every existing session, since
   * whoever forced the reset may be holding one.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const consumed = await this.tokens.consume(
      token,
      VerificationTokenPurpose.PASSWORD_RESET,
    );
    if (!consumed) throw new BadRequestException(INVALID_LINK);

    const user = await this.prisma.user.findUnique({
      where: { id: consumed.userId },
    });
    // The address moved after the link was sent: the mail landed in an inbox
    // the account no longer belongs to, so the link is void.
    if (!user || user.email !== consumed.email) {
      throw new BadRequestException(INVALID_LINK);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hash(newPassword, ARGON2_OPTIONS),
        // Redeeming the link proved control of the inbox, which is exactly
        // what verification asks for — no point sending a second mail.
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });

    await this.sessions.revokeAllSessionsForUser(user.id);
    this.logger.log(`Password reset completed for user ${user.id}`);
  }

  /**
   * Send (or re-send) the verification link. No-op on an already-verified
   * address. `preferredLocale` covers signup, where no settings row exists yet
   * and the only clue is the language the form was rendered in.
   */
  async sendEmailVerification(
    user: Pick<User, 'id' | 'email'>,
    preferredLocale?: string,
  ): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, emailVerifiedAt: true },
    });
    if (!current || current.emailVerifiedAt) return;

    const token = await this.tokens.issue(
      user.id,
      current.email,
      VerificationTokenPurpose.EMAIL_VERIFICATION,
      EMAIL_VERIFICATION_TTL_HOURS * HOUR_MS,
    );

    this.deliver(
      emailVerificationMail(
        current.email,
        preferredLocale
          ? resolveMailLocale(preferredLocale)
          : await this.localeFor(user.id),
        this.link('/verify-email', token),
        EMAIL_VERIFICATION_TTL_HOURS,
      ),
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const consumed = await this.tokens.consume(
      token,
      VerificationTokenPurpose.EMAIL_VERIFICATION,
    );
    if (!consumed) throw new BadRequestException(INVALID_LINK);

    const user = await this.prisma.user.findUnique({
      where: { id: consumed.userId },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user || user.email !== consumed.email) {
      throw new BadRequestException(INVALID_LINK);
    }
    if (user.emailVerifiedAt) return;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    this.logger.log(`E-mail verified for user ${user.id}`);
  }

  /**
   * Not awaited on purpose. The caller answers the same way whether or not an
   * account exists, and awaiting an SMTP round trip would leak that difference
   * through response time. Delivery failures are the mailer's to log.
   */
  private deliver(mail: Parameters<MailService['send']>[0]): void {
    void this.mail.send(mail);
  }

  private link(path: string, token: string): string {
    const base = (process.env.APP_URL ?? 'http://localhost:4200').replace(
      /\/+$/,
      '',
    );
    return `${base}${path}?token=${encodeURIComponent(token)}`;
  }

  private async localeFor(
    userId: number,
  ): Promise<ReturnType<typeof resolveMailLocale>> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { locale: true },
    });
    return resolveMailLocale(settings?.locale);
  }
}

/** One message for every failure mode: expired, spent, unknown, wrong purpose. */
const INVALID_LINK = 'This link is invalid or has expired.';
