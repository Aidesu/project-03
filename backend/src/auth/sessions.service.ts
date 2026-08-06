import { timingSafeEqual } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

/**
 * One signed-in device, as the user understands it.
 *
 * Keyed on the rotation family, not on the `RefreshSession` row: a device that
 * stays connected mints a new row every time its token rotates, so listing rows
 * would show the same laptop several times and hand out an id that stops
 * working minutes later. The family id is a UUID, opaque and non-sequential,
 * which is what we want on the wire.
 */
export interface ActiveSession {
  id: string;
  ip: string | null;
  userAgent: string | null;
  /** When this device signed in — carried across every rotation of the family. */
  signedInAt: Date;
  /** Last rotation, i.e. the last time this device was demonstrably in use. */
  lastSeenAt: Date;
  expiresAt: Date;
  /** The device making this very request. Cannot be revoked here — see below. */
  current: boolean;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Active sessions for a user, newest first.
   *
   * `currentRawToken` comes from the caller's own refresh cookie, so this only
   * ever flags a session the caller already holds — it is a display concern,
   * not an authorization one.
   */
  async listActive(
    userId: number,
    currentRawToken?: string,
  ): Promise<ActiveSession[]> {
    const rows = await this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        familyId: true,
        tokenHash: true,
        familyCreatedAt: true,
        createdAt: true,
        expiresAt: true,
        userAgent: true,
        ip: true,
      },
    });

    const currentHash = currentRawToken
      ? this.tokens.hashToken(currentRawToken)
      : null;

    // Rotation revokes the old row inside the same transaction that writes the
    // new one, so a family holds at most one live row. Collapsing defensively
    // anyway: `orderBy` above means the first row wins, which is the newest.
    const byFamily = new Map<string, ActiveSession>();
    for (const row of rows) {
      if (byFamily.has(row.familyId)) continue;
      byFamily.set(row.familyId, {
        id: row.familyId,
        ip: row.ip,
        userAgent: row.userAgent,
        signedInAt: row.familyCreatedAt,
        lastSeenAt: row.createdAt,
        expiresAt: row.expiresAt,
        current:
          currentHash !== null && hashesEqual(row.tokenHash, currentHash),
      });
    }

    return [...byFamily.values()];
  }

  /**
   * Revoke one device.
   *
   * Scoped by `userId` in the same `where` as the id: the family id travels in
   * the URL, and an id in a URL proves nothing. A family belonging to someone
   * else matches zero rows and is reported exactly like one that does not
   * exist, so this cannot be used to probe for other users' sessions.
   *
   * Revoking the caller's own session is refused rather than handled: it would
   * leave this request holding cookies for a dead session, and logout already
   * owns that path — one place that clears cookies, not two.
   */
  async revokeFamily(
    userId: number,
    familyId: string,
    currentRawToken: string | undefined,
    ctx: RequestContext = {},
  ): Promise<void> {
    if (currentRawToken) {
      const currentHash = this.tokens.hashToken(currentRawToken);
      const isCurrent = await this.prisma.refreshSession.findFirst({
        where: { userId, familyId, tokenHash: currentHash },
        select: { id: true },
      });
      if (isCurrent) {
        throw new CurrentSessionRevocationError();
      }
    }

    const { count } = await this.prisma.refreshSession.updateMany({
      where: { userId, familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (count === 0) throw new NotFoundException('Session not found');

    await this.audit.success(AuditAction.SESSION_REVOKED, {
      userId,
      context: ctx,
      metadata: { familyId, sessionsRevoked: count, scope: 'single' },
    });
  }

  /**
   * Revoke every device except the one asking — the "someone else is in my
   * account" button. Keeping the caller signed in is the point: forcing them
   * to log back in after a panic click is exactly when they mistype a password.
   */
  async revokeAllOthers(
    userId: number,
    currentRawToken: string | undefined,
    ctx: RequestContext = {},
  ): Promise<number> {
    const currentHash = currentRawToken
      ? this.tokens.hashToken(currentRawToken)
      : null;

    // Resolved to a family id rather than excluding the single row: the caller
    // is one device, and its family must survive whole, including the row a
    // concurrent rotation may have just written.
    const currentFamilyId = currentHash
      ? ((
          await this.prisma.refreshSession.findFirst({
            where: { userId, tokenHash: currentHash },
            select: { familyId: true },
          })
        )?.familyId ?? null)
      : null;

    const { count } = await this.prisma.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentFamilyId ? { familyId: { not: currentFamilyId } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    if (count > 0) {
      await this.audit.success(AuditAction.SESSION_REVOKED, {
        userId,
        context: ctx,
        metadata: { sessionsRevoked: count, scope: 'others' },
      });
    }

    return count;
  }
}

/** Refusing to revoke the session making the request — mapped to 400 upstream. */
export class CurrentSessionRevocationError extends Error {
  constructor() {
    super('Cannot revoke the session making this request');
  }
}

/**
 * Both values are hex digests of the same fixed length, so this is really a
 * constant-time habit rather than a defence against a practical oracle — the
 * caller already holds the token being compared. Cheap enough to keep.
 */
function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
