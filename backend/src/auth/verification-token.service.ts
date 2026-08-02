import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { VerificationTokenPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Short: a recovery link is a password equivalent while it is alive. */
export const PASSWORD_RESET_TTL_MINUTES = 30;
/** Longer: people confirm an address when they next open their mail, not now. */
export const EMAIL_VERIFICATION_TTL_HOURS = 24;

export interface ConsumedToken {
  userId: number;
  /** The address the token was issued for — the caller must still match it. */
  email: string;
}

/**
 * Single-use, expiring tokens delivered by e-mail.
 *
 * Same reasoning as refresh tokens: the raw value is 256 bits of entropy and
 * only its keyed hash is stored, so a database dump (SQL injection, a restored
 * backup) yields nothing replayable — the key lives in the environment, never
 * in a row.
 */
@Injectable()
export class VerificationTokenService {
  private readonly secret = process.env.EMAIL_TOKEN_SECRET as string;

  constructor(private readonly prisma: PrismaService) {}

  private hash(raw: string): string {
    return createHmac('sha256', this.secret).update(raw).digest('hex');
  }

  /**
   * Mint a token, superseding any outstanding one of the same purpose: asking
   * for a second reset link must not leave the first one usable, or a stolen
   * older mail stays a live key to the account.
   */
  async issue(
    userId: number,
    email: string,
    purpose: VerificationTokenPurpose,
    ttlMs: number,
  ): Promise<string> {
    const now = new Date();
    const raw = randomBytes(32).toString('base64url');

    await this.prisma.$transaction([
      this.prisma.verificationToken.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: now },
      }),
      // Opportunistic retention: spent and expired rows for this user are of
      // no further use, and nothing else prunes this table.
      this.prisma.verificationToken.deleteMany({
        where: { userId, expiresAt: { lt: new Date(now.getTime() - ttlMs) } },
      }),
      this.prisma.verificationToken.create({
        data: {
          userId,
          purpose,
          email,
          tokenHash: this.hash(raw),
          expiresAt: new Date(now.getTime() + ttlMs),
        },
      }),
    ]);

    return raw;
  }

  /**
   * Redeem a token, or return null if it is unknown, expired, already spent or
   * of the wrong purpose.
   *
   * "Already spent" is decided by the database, not by a read followed by a
   * write: the `consumedAt: null` guard lives in the WHERE clause, so of two
   * requests racing on the same link exactly one gets a row count of 1. A
   * check-then-act here would let a leaked link be redeemed twice.
   */
  async consume(
    raw: string,
    purpose: VerificationTokenPurpose,
  ): Promise<ConsumedToken | null> {
    const tokenHash = this.hash(raw);

    const { count } = await this.prisma.verificationToken.updateMany({
      where: {
        tokenHash,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (count === 0) return null;

    const row = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
      select: { userId: true, email: true },
    });
    return row;
  }
}
