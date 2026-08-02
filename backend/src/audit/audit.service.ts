import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, AuditOutcome } from '@prisma/client';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

/** Longest possible IPv6 text form, including an IPv4-mapped suffix. */
const MAX_IP_LENGTH = 45;
const MAX_USER_AGENT_LENGTH = 255;

/**
 * Non-identifying context attached to an event: a failure reason, a counter, a
 * session family id. Never an address, a name, a token, or a request body —
 * the trail must stay useful without becoming a second copy of the user data.
 */
export type AuditMetadata = Record<string, string | number | boolean>;

export interface AuditEntryOptions {
  /** Internal User.id. Omitted when the actor is unauthenticated or unknown. */
  userId?: number | null;
  context?: RequestContext;
  metadata?: AuditMetadata;
}

/**
 * Writes the append-only security trail (see the `AuditLog` model). Recording
 * is the point: nothing here ever reads or amends an entry, and the database
 * rejects UPDATE outright.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  success(action: AuditAction, options: AuditEntryOptions = {}): Promise<void> {
    return this.record(action, AuditOutcome.SUCCESS, options);
  }

  failure(action: AuditAction, options: AuditEntryOptions = {}): Promise<void> {
    return this.record(action, AuditOutcome.FAILURE, options);
  }

  /**
   * Never throws.
   *
   * The trade-off is deliberate: failing closed here would make this table a
   * single point of failure for every login, password change and deletion in
   * the product — one bad index or a full disk and nobody can authenticate.
   * A dropped entry is instead surfaced as an ERROR log carrying the same
   * correlation id, so the gap is detectable rather than silent.
   */
  private async record(
    action: AuditAction,
    outcome: AuditOutcome,
    { userId, context, metadata }: AuditEntryOptions,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          outcome,
          userId: userId ?? null,
          ip: truncate(context?.ip, MAX_IP_LENGTH),
          userAgent: truncate(context?.userAgent, MAX_USER_AGENT_LENGTH),
          correlationId: context?.correlationId ?? null,
          metadata,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record audit entry ${action}/${outcome} [correlationId=${context?.correlationId ?? 'none'}]`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Retention: the trail holds IP addresses and user agents, which are personal
   * data and therefore cannot be kept indefinitely. Deleting is the one write
   * besides INSERT the table allows.
   */
  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.auditLog.deleteMany({
      where: { occurredAt: { lt: cutoff } },
    });
    return count;
  }
}

function truncate(
  value: string | null | undefined,
  max: number,
): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}
