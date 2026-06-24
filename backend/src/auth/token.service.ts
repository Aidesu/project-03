import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessTokenPayload {
  sub: number;
  email: string;
  role: Role;
}

export interface RefreshContext {
  userAgent?: string | null;
  ip?: string | null;
}

/** Domain error for any refresh-token failure (mapped to 401 by the caller). */
export class RefreshTokenError extends Error {}

@Injectable()
export class TokenService {
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET as string;
  private readonly accessTtl = process.env.ACCESS_TOKEN_TTL ?? '15m';
  private readonly refreshTtlDays = Number(
    process.env.REFRESH_TOKEN_TTL_DAYS ?? 7,
  );

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // --- Access tokens (stateless JWT) ---

  issueAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl as JwtSignOptions['expiresIn'],
    });
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.accessSecret,
    });
  }

  // --- Refresh tokens (opaque, stored hashed, rotating) ---

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);
  }

  private generateRawToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /** Start a brand-new session (login/register) — opens a fresh rotation family. */
  async issueRefreshSession(
    userId: number,
    ctx: RefreshContext = {},
  ): Promise<string> {
    const token = this.generateRawToken();
    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        familyId: randomUUID(),
        expiresAt: this.refreshExpiry(),
        userAgent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
      },
    });
    return token;
  }

  /**
   * Rotate a refresh token: revoke the presented one and mint its successor in
   * the same family. Throws {@link RefreshTokenError} on invalid/expired tokens.
   * If an already-revoked token is replayed, the whole family is revoked (theft).
   */
  async rotateRefreshSession(
    rawToken: string,
    ctx: RefreshContext = {},
  ): Promise<{ token: string; userId: number }> {
    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.refreshSession.findFirst({
      where: { tokenHash },
    });

    if (!session) throw new RefreshTokenError('Unknown refresh token');

    if (session.revokedAt) {
      // Replay of a rotated/revoked token → likely theft: burn the family.
      await this.prisma.refreshSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new RefreshTokenError('Refresh token reuse detected');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new RefreshTokenError('Refresh token expired');
    }

    const token = this.generateRawToken();
    await this.prisma.$transaction([
      this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshSession.create({
        data: {
          userId: session.userId,
          tokenHash: this.hashToken(token),
          familyId: session.familyId,
          expiresAt: this.refreshExpiry(),
          userAgent: ctx.userAgent ?? null,
          ip: ctx.ip ?? null,
        },
      }),
    ]);

    return { token, userId: session.userId };
  }

  /** Revoke a session by its raw token (logout). No-op when not found. */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
