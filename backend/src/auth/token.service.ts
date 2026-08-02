import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AuditAction, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

// Pinned so a token can only ever be validated under the algorithm we sign
// with. Left open, a verifier will accept any algorithm the key shape allows,
// which is the root of the classic JWT confusion attacks.
const JWT_ALGORITHM = 'HS256' as const;
const JWT_ISSUER = 'project-03';
const JWT_AUDIENCE = 'project-03-api';

export interface AccessTokenPayload {
  sub: number;
  email: string;
  role: Role;
}

/** Domain error for any refresh-token failure (mapped to 401 by the caller). */
export class RefreshTokenError extends Error {}

@Injectable()
export class TokenService {
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET as string;
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET as string;
  private readonly accessTtl = process.env.ACCESS_TOKEN_TTL ?? '15m';
  private readonly refreshTtlDays = Number(
    process.env.REFRESH_TOKEN_TTL_DAYS ?? 7,
  );

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Access tokens (stateless JWT) ---

  issueAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: this.accessTtl as JwtSignOptions['expiresIn'],
    });
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.accessSecret,
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  // --- Refresh tokens (opaque, stored hashed, rotating) ---

  /**
   * Keyed hash, not a bare digest. The token itself is 256 bits of entropy so
   * a plain SHA-256 would already be preimage-safe; the key buys something
   * else — an attacker with write access to the database (SQL injection, a
   * restored backup) still cannot mint a session row matching a token they
   * chose, because the key never lives in the database.
   */
  private hashToken(raw: string): string {
    return createHmac('sha256', this.refreshSecret).update(raw).digest('hex');
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
    ctx: RequestContext = {},
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
    ctx: RequestContext = {},
  ): Promise<{ token: string; userId: number }> {
    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.refreshSession.findFirst({
      where: { tokenHash },
    });

    if (!session) throw new RefreshTokenError('Unknown refresh token');

    if (session.revokedAt) {
      // Replay of a rotated/revoked token → likely theft: burn the family.
      const { count } = await this.prisma.refreshSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // The one event in this file worth a permanent record: it means a token
      // left the device it was issued to.
      await this.audit.failure(AuditAction.REFRESH_TOKEN_REUSE_DETECTED, {
        userId: session.userId,
        context: ctx,
        metadata: { familyId: session.familyId, sessionsRevoked: count },
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

  /**
   * Revoke every active session for a user — used after a password change or
   * account deletion, where every device must be forced to re-authenticate.
   */
  async revokeAllSessionsForUser(userId: number): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
